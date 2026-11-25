"""Famous local dishes for a trip's destination, as Wikipedia describes them.

There is no free, structured data source for "what a city is known to eat", so the LLM that writes
trip rationales only proposes dish names. Each name is looked up on Wikipedia (REST page summary:
free, no key), and a dish is kept only when Wikipedia has an article on that food (its short
description names a dish, food, sweet, drink...): what is shown is Wikipedia's own title, text and
photo, labelled "Wikipedia". A name without such an article is dropped, and no AI text is shown.
The result is saved with the city's places (city_places), so a city is asked about once per
PLACES_CACHE_DAYS.
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


# Wikipedia's short description of a food page: "Indian sweet", "Goan dessert", "Rajasthani dish".
FOOD = re.compile(r"dish|food|cuisine|sweet|dessert|snack|bread|curry|drink|beverage|pastry|cake|pudding|"
                  r"soup|stew|condiment|sauce|chutney|pickle|spice|confection|noodle|dumpling|rice|meat|fish|"
                  r"liquor|wine|tea|coffee|street food|delicacy|flatbread|porridge|salad|fritter|biscuit", re.I)


def _is_food(body: dict) -> bool:
    return bool(FOOD.search(body.get("description") or ""))


def _specific_words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]+", text.lower()) if len(w) > 2 and w not in GENERIC}


def wikipedia(name: str) -> dict:
    """Photo, short text and page link for a dish, or {} when Wikipedia has no page for it.

    The exact title is tried first ("Butter chicken"); otherwise Wikipedia's own search, accepted
    only when the page title shares a specific word with the dish ("Pork Vindaloo" -> "Vindaloo")."""
    body = _summary(name)
    if body is not None and not _is_food(body):
        body = None  # "Sannas" is also a cotton cloth: only a page about food will do
    if body is None:
        found = _get(WIKIPEDIA_SEARCH, q=name, limit=3) or {}
        for page in found.get("pages") or []:
            title = page.get("title") or ""
            if _specific_words(title) & _specific_words(name):
                candidate = _summary(title)
                if candidate is not None and _is_food(candidate):
                    body = candidate
                    break
    if body is None:
        return {}
    text = (body.get("extract") or "").strip()
    if len(text) > WIKI_TEXT_CHARS:
        text = text[:WIKI_TEXT_CHARS].rsplit(" ", 1)[0] + "..."
    return {
        "title": body.get("title"),
        "image": (body.get("thumbnail") or {}).get("source"),
        "wikipedia_text": text or None,
        "wikipedia": ((body.get("content_urls") or {}).get("desktop") or {}).get("page"),
    }


def local_dishes(city: str, region: str) -> list[dict]:
    """The proposed dishes Wikipedia has an article on, with Wikipedia's title, text and photo."""
    dishes, seen = [], set()
    for dish in ask_llm(city, region):
        wiki = wikipedia(dish["name"])
        if not wiki or not wiki.get("wikipedia") or wiki.get("title") in seen:
            continue  # no article on this food: nothing real to show
        seen.add(wiki.get("title"))
        dishes.append({
            "name": wiki.get("title") or dish["name"],
            "ai_description": None,
            "image": wiki.get("image"),
            "wikipedia_text": wiki.get("wikipedia_text"),
            "wikipedia": wiki.get("wikipedia"),
            "data_label": "Wikipedia",
            "image_label": "Photo: Wikipedia" if wiki.get("image") else None,
        })
    return dishes
