"""Famous local dishes for a trip's destination: names from the LLM, photos from Wikipedia.

There is no free, structured data source for "what a city is known to eat", so the names and the
one-line descriptions come from the same LLM that writes trip rationales (Gemini), and every dish
is labelled "AI suggestion". The LLM is never asked for prices, ratings or any other number, and
a line that contains a digit anyway is dropped.

Each dish name is then looked up on Wikipedia (REST page summary: free, no key) for a real photo
and a short description, labelled "Photo: Wikipedia". A dish Wikipedia has no page for keeps
only the AI text. The result is saved with the city's places (city_places), so a city is asked
about once per PLACES_CACHE_DAYS.
"""
import json
import logging
import re
from urllib.parse import quote

import httpx

from app.pipeline import graph

logger = logging.getLogger(__name__)

WIKIPEDIA_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/"
USER_AGENT = "AI-Trip-Optimizer/1.0 (https://github.com/bhuvan-somisetty/AI-Trip-Optimizer)"
WIKIPEDIA_SEARCH = "https://en.wikipedia.org/w/rest.php/v1/search/page"
MAX_DISHES = 6
WIKI_TEXT_CHARS = 240

PROMPT = """List the {n} most famous local dishes or foods that visitors should try in {city}, {region}.
Answer with JSON only, no markdown: a list of objects with keys "name" (the dish's common English
or local name, as Wikipedia would title it) and "description" (one plain sentence about what it is).
Do not mention prices, ratings, quantities, years or any other number."""


class DishesUnavailable(Exception):
    """No LLM is configured on the server."""


def _clean(items) -> list[dict]:
    dishes, seen = [], set()
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        description = str(item.get("description") or "").strip()
        if not name or len(name) > 60 or name.lower() in seen:
            continue
        if re.search(r"\d", name + description):
            continue  # the LLM may not state numbers here
        seen.add(name.lower())
        dishes.append({"name": name, "ai_description": description or None})
        if len(dishes) == MAX_DISHES:
            break
    return dishes


def ask_llm(city: str, region: str) -> list[dict]:
    llm = graph.get_llm()
    if llm is None:
        raise DishesUnavailable("Local dishes need the AI model on the server (no OPENAI_API_KEY)")
    text = llm.invoke(PROMPT.format(n=MAX_DISHES, city=city, region=region)).content.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)  # tolerate a fenced answer
    try:
        return _clean(json.loads(text))
    except ValueError:
        logger.warning("Dishes answer wasn't JSON: %s", text[:200])
        return []


def _get(url: str, **params) -> dict | None:
    try:
        response = httpx.get(
            url,
            params=params or None,
            # Wikimedia's robot policy refuses requests without a contactable User-Agent.
            headers={"User-Agent": USER_AGENT},
            timeout=15,
            follow_redirects=True,
        )
    except httpx.HTTPError:
        return None
    if response.status_code != 200:
        return None
    try:
        return response.json()
    except ValueError:
        return None


def _summary(title: str) -> dict | None:
    body = _get(WIKIPEDIA_SUMMARY + quote(title.replace(" ", "_")))
    # A disambiguation or missing page is not this dish.
    return body if body and body.get("type") == "standard" else None


# Words too general to tell one dish from another: "Goan fish curry" matching the page
# "Fish curry" or "Goan cuisine" would show the wrong food.
GENERIC = {"goan", "goa", "delhi", "indian", "india", "north", "south", "chicken", "pork", "fish",
           "mutton", "beef", "lamb", "prawn", "curry", "rice", "style", "dish", "sweet", "the"}


def _specific_words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]+", text.lower()) if len(w) > 2 and w not in GENERIC}


def wikipedia(name: str) -> dict:
    """Photo, short text and page link for a dish, or {} when Wikipedia has no page for it.

    The exact title is tried first ("Butter chicken"); otherwise Wikipedia's own search, accepted
    only when the page title shares a specific word with the dish ("Pork Vindaloo" -> "Vindaloo")."""
    body = _summary(name)
    if body is None:
        found = _get(WIKIPEDIA_SEARCH, q=name, limit=3) or {}
        for page in found.get("pages") or []:
            title = page.get("title") or ""
            if _specific_words(title) & _specific_words(name):
                body = _summary(title)
                break
    if body is None:
        return {}
    text = (body.get("extract") or "").strip()
    if len(text) > WIKI_TEXT_CHARS:
        text = text[:WIKI_TEXT_CHARS].rsplit(" ", 1)[0] + "..."
    return {
        "image": (body.get("thumbnail") or {}).get("source"),
        "wikipedia_text": text or None,
        "wikipedia": ((body.get("content_urls") or {}).get("desktop") or {}).get("page"),
    }


def local_dishes(city: str, region: str) -> list[dict]:
    """Up to MAX_DISHES dishes, each labelled: AI text always, Wikipedia photo and text when found."""
    dishes = []
    for dish in ask_llm(city, region):
        wiki = wikipedia(dish["name"])
        dishes.append({
            **dish,
            "image": wiki.get("image"),
            "wikipedia_text": wiki.get("wikipedia_text"),
            "wikipedia": wiki.get("wikipedia"),
            "data_label": "AI suggestion",
            "image_label": "Photo: Wikipedia" if wiki.get("image") else None,
        })
    return dishes
