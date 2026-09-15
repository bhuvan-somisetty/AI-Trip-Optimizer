from fastapi import FastAPI

app = FastAPI(title="AI Trip Optimizer API")


@app.get("/health")
def health():
    return {"status": "ok"}
