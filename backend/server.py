from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from core import client
from seed import seed_admin, ensure_indexes, seed_data
from routers import auth, catalog, appointments, prescriptions, doctor, admin, ai

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("horizoncare")

app = FastAPI(title="HorizonCare API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"service": "HorizonCare API", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "ok"}


for r in (auth.router, catalog.router, appointments.router, prescriptions.router, doctor.router, admin.router, ai.router):
    api_router.include_router(r)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[o.strip() for o in os.environ["CORS_ORIGINS"].split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await ensure_indexes()
    await seed_admin()
    await seed_data()
    logger.info("HorizonCare startup complete")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
