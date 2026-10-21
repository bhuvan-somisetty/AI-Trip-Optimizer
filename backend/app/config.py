import os

from dotenv import load_dotenv

# Picks up backend/.env (or the repo-root .env) for local runs; real env vars still win.
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ai_trip_optimizer")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24

# compose_node's rationale. With no key the pipeline falls back to a template rationale.
# Any OpenAI-compatible endpoint works (e.g. Gemini's free tier) by setting OPENAI_BASE_URL.
# `or` so an empty OPENAI_MODEL= / OPENAI_BASE_URL= line in .env falls back to the default.
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL") or None
OPENAI_MODEL = os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
