import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from core import db, now_iso, new_id

logger = logging.getLogger("horizoncare.email")

# Emergent managed email proxy — constant by design, never from env.
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "HorizonCare")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
APP_URL = os.environ.get("APP_PUBLIC_URL", "http://localhost:3000")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send", headers={"X-Email-Key": EMAIL_KEY}, json=payload)
    resp.raise_for_status()
    return resp.json().get("id")


def _layout(title: str, lines: list[str], cta: str = "Open my dashboard") -> str:
    body = "".join(f'<p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.5">{ln}</p>' for ln in lines)
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">'
        '<tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" '
        'style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;font-family:Arial,sans-serif">'
        f'<tr><td style="background:#0d9488;color:#ffffff;padding:20px 28px;border-radius:16px 16px 0 0;font-size:18px;font-weight:bold">{escape(EMAIL_FROM_NAME)}</td></tr>'
        f'<tr><td style="padding:28px"><h2 style="margin:0 0 16px;color:#0f172a;font-size:20px">{title}</h2>{body}'
        f'<p style="margin:20px 0 0"><a href="{APP_URL}/patient" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:bold;font-size:14px">{cta}</a></p></td></tr>'
        f'<tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px">Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or payment details by email.</td></tr>'
        "</table></td></tr></table>"
    )


def _when(a: dict) -> str:
    return f"{escape(a['date'])} at {escape(a['time'])}"


TEMPLATES = {
    "booking_confirmed": lambda a: (
        f"Appointment confirmed with Dr. {a['doctor_name']}",
        _layout("Your appointment is confirmed",
                [f"Hi {escape(a['patient_name'])}, your visit with <strong>Dr. {escape(a['doctor_name'])}</strong> ({escape(a['specialization_name'])}) is booked.",
                 f"<strong>When:</strong> {_when(a)}<br><strong>Where:</strong> {escape(a['hospital_name'])}<br><strong>Queue token:</strong> #{a['token_number']}",
                 "Please arrive 10 minutes early and check in from your dashboard to join the live queue."])),
    "reminder_24h": lambda a: (
        f"Reminder: appointment tomorrow with Dr. {a['doctor_name']}",
        _layout("Your appointment is tomorrow",
                [f"Hi {escape(a['patient_name'])}, this is a reminder of your visit with <strong>Dr. {escape(a['doctor_name'])}</strong> at {escape(a['hospital_name'])}.",
                 f"<strong>When:</strong> {_when(a)}<br><strong>Queue token:</strong> #{a['token_number']}",
                 "Need to change plans? You can reschedule or cancel from your dashboard."])),
    "reminder_1h": lambda a: (
        f"Starting soon: Dr. {a['doctor_name']} at {a['time']}",
        _layout("Your appointment starts in about an hour",
                [f"Hi {escape(a['patient_name'])}, your visit with <strong>Dr. {escape(a['doctor_name'])}</strong> is at <strong>{escape(a['time'])}</strong> today at {escape(a['hospital_name'])}.",
                 f"Your queue token is <strong>#{a['token_number']}</strong>. Check in on arrival to track the live queue."], "Track my queue")),
    "cancelled": lambda a: (
        f"Appointment cancelled — Dr. {a['doctor_name']}",
        _layout("Your appointment was cancelled",
                [f"Hi {escape(a['patient_name'])}, your appointment with <strong>Dr. {escape(a['doctor_name'])}</strong> on {_when(a)} has been cancelled"
                 + (" by the hospital." if a.get('cancelled_by') in ('doctor', 'admin') else "."),
                 "You can book a new slot anytime from your dashboard."], "Book again")),
    "rescheduled": lambda a: (
        f"Appointment rescheduled — Dr. {a['doctor_name']}",
        _layout("Your appointment has a new time",
                [f"Hi {escape(a['patient_name'])}, your visit with <strong>Dr. {escape(a['doctor_name'])}</strong> at {escape(a['hospital_name'])} has moved.",
                 f"<strong>New time:</strong> {_when(a)}<br><strong>New queue token:</strong> #{a['token_number']}"])),
}


async def notify(kind: str, appt: dict):
    """Send a templated email for an enriched appointment; never raises."""
    if not EMAIL_KEY:
        return  # Notifications disabled — no email key configured
    to = appt.get("patient_email")
    if not to or kind not in TEMPLATES:
        return
    subject, html = TEMPLATES[kind](appt)
    log = {"id": new_id(), "kind": kind, "appointment_id": appt["id"], "to": to, "created_at": now_iso()}
    try:
        log["email_id"] = await send_email(to=to, subject=subject, html=html)
        log["status"] = "sent"
    except Exception as e:
        logger.error(f"notify {kind} failed: {e}")
        log["status"] = "failed"
        log["error"] = str(e)[:300]
    await db.notifications.insert_one(log)