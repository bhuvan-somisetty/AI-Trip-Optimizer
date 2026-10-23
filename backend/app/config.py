import os

from dotenv import load_dotenv

# Picks up backend/.env (or the repo-root .env) for local runs; real env vars still win.
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ai_trip_optimizer")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24

# compose_node's rationale. With no key the pipeline falls back to a template rationale.
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Real travel data (app/travel_data.py).
# Flights: free token from https://www.travelpayouts.com (Profile -> API token).
TRAVELPAYOUTS_TOKEN = os.getenv("TRAVELPAYOUTS_TOKEN", "")
# Hotels: a LiteAPI *production* key from https://dashboard.liteapi.travel (needs a card on file;
# rate searches are free). Without one, hotel prices are shown as unavailable.
LITEAPI_API_KEY = os.getenv("LITEAPI_API_KEY", "")
SEARCH_CACHE_MINUTES = int(os.getenv("SEARCH_CACHE_MINUTES", "30"))
