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

# Real travel data (app/travel_data.py).
# Flights: free token from https://www.travelpayouts.com (Profile -> API token).
TRAVELPAYOUTS_TOKEN = os.getenv("TRAVELPAYOUTS_TOKEN", "")
# Hotels: a SerpApi key (Google Hotels prices) from https://serpapi.com, free plan, no card.
# Without one, hotel prices are shown as unavailable.
SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY", "")
SEARCH_CACHE_MINUTES = int(os.getenv("SEARCH_CACHE_MINUTES") or "30")

# Sign in with Google: the OAuth Web client ID from Google Cloud (Google Auth Platform -> Clients).
# Only the ID is needed, to check that Google's ID tokens were issued for this app; without it
# POST /auth/google answers 503 and email/password sign-in still works.
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
