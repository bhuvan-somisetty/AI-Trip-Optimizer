from fastapi import FastAPI

from app.routers import auth, travelers

app = FastAPI(title="AI Trip Optimizer API")

app.include_router(auth.router)
app.include_router(travelers.router)


@app.get("/health")
def health():
    return {"status": "ok"}
