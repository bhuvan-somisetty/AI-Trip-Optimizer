import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, travelers, trips

app = FastAPI(title="AI Trip Optimizer API")

# Allows the Next.js dev server (and a deployed frontend, via CORS_ORIGINS) to call this API.
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(travelers.router)
app.include_router(trips.router)


@app.get("/health")
def health():
    return {"status": "ok"}
