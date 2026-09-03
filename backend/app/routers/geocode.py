import json
import ssl
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import certifi
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import settings
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.geocode import GeocodeResult

router = APIRouter(prefix="/geocode", tags=["geocode"])

MAX_RESULTS = 5

# Some Python builds (the python.org macOS ones among them) ship with no CA
# bundle, so a plain urlopen fails TLS verification. Pin certifi's bundle
# instead of weakening verification, which must never be switched off.
_TLS_CONTEXT = ssl.create_default_context(cafile=certifi.where())

# Nominatim's usage policy allows one request a second from a single client and
# asks that we not repeat lookups, so calls are serialised behind a lock and
# recent answers are kept. The cache is per-process and deliberately dumb:
# addresses do not move, and losing it on restart costs nothing.
_MIN_INTERVAL_SECONDS = 1.0
_CACHE_LIMIT = 256

_call_lock = threading.Lock()
_last_call_at = 0.0
_cache: dict[str, list[dict]] = {}


def _search_upstream(query: str) -> list[dict]:
    """One rate-limited call to the geocoder. Raises on any transport error."""
    global _last_call_at

    # The host comes from settings and the query is encoded into the query
    # string, so a provider's text can never redirect this at another server.
    url = f"{settings.NOMINATIM_URL}?" + urlencode(
        {"q": query, "format": "jsonv2", "limit": MAX_RESULTS}
    )
    request = Request(url, headers={"User-Agent": settings.GEOCODER_USER_AGENT})

    with _call_lock:
        overdue = _MIN_INTERVAL_SECONDS - (time.monotonic() - _last_call_at)
        if overdue > 0:
            time.sleep(overdue)
        try:
            with urlopen(
                request,
                timeout=settings.GEOCODER_TIMEOUT_SECONDS,
                context=_TLS_CONTEXT,
            ) as response:
                return json.load(response)
        finally:
            _last_call_at = time.monotonic()


@router.get("", response_model=list[GeocodeResult])
def geocode(
    q: str = Query(min_length=3, max_length=200, description="Address or place to look up."),
    current_user: User = Depends(get_current_user),
):
    """Turn typed text into candidate coordinates for the listing location
    picker. Requires an account: only signed-in students post listings, and
    this fronts a shared public service that anonymous traffic could flood."""
    key = " ".join(q.lower().split())
    cached = _cache.get(key)
    if cached is not None:
        return cached

    try:
        raw = _search_upstream(q)
        # Nominatim can return the same place twice (separate OSM objects that
        # share a name and a position), which is noise in a list of choices.
        # Collapse them, keeping the order the geocoder ranked them in.
        results = []
        seen = set()
        for item in raw:
            if not (item.get("display_name") and item.get("lat") and item.get("lon")):
                continue
            candidate = {
                "display_name": item["display_name"],
                "latitude": float(item["lat"]),
                "longitude": float(item["lon"]),
            }
            fingerprint = (
                candidate["display_name"],
                candidate["latitude"],
                candidate["longitude"],
            )
            if fingerprint in seen:
                continue
            seen.add(fingerprint)
            results.append(candidate)
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError, TypeError) as exc:
        # An upstream hiccup is not the provider's fault and must not read as a
        # bug in Quad, so say what to do instead.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Location search is unavailable right now. Drop a pin on the map instead.",
        ) from exc

    if len(_cache) >= _CACHE_LIMIT:
        _cache.clear()
    _cache[key] = results
    return results
