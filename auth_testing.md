# Auth Testing Playbook — HorizonCare

## JWT email/password auth
- Login: `curl -c cookies.txt -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"thakaregaurav0911@gmail.com","password":"Admin@123"}'`
- Response body includes `access_token` (also set as httpOnly cookie). Use either `-b cookies.txt` or `-H "Authorization: Bearer <access_token>"` for protected calls.
- `/api/auth/me` returns the user (id, email, name, role).
- Brute force: 5 failed logins for same ip:email → 429 for 15 minutes.

## Emergent Google Auth (patients)
- Frontend button redirects to `https://auth.emergentagent.com/?redirect=<origin>/patient`.
- On return, `/patient#session_id=...` → frontend POSTs `/api/auth/google/session` → backend exchanges session id, stores `user_sessions`, sets `session_token` cookie.
- To simulate: insert a user + `user_sessions` doc (fields: user_id, session_token, expires_at ISO string) then call `/api/auth/me` with `Authorization: Bearer <session_token>`.

## MongoDB verification
```
mongosh --eval "use('test_database'); db.users.find({role:'admin'}).pretty(); db.users.getIndexes();"
```
Expect bcrypt hashes starting with `$2b$`, unique index on `users.email`, partial unique index on `appointments (doctor_id, date, time)` for active statuses.
