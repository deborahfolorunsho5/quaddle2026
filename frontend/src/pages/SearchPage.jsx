import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api, mediaUrl } from "../api/client";
import { SearchIcon } from "../components/icons";
import { distanceMiles, formatWalkShort, pinOf } from "../lib/geo";
import { useMyLocation } from "../lib/useMyLocation";

// Every ninth listing with a photo gets a double tile, so the grid has a
// rhythm instead of reading as a sheet of identical thumbnails.
const FEATURE_EVERY = 9;
// How long typing has to pause before a search goes out. Short enough to feel
// instant, long enough that "braids" is one request rather than six.
const SEARCH_DELAY_MS = 300;

export default function SearchPage() {
  // The home screen's category tiles link here with ?category=.
  const [params] = useSearchParams();
  const { position, status, request } = useMyLocation();

  // q is what is in the box; query is what was last searched for, once the
  // typing paused.
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(params.get("category"));
  const [error, setError] = useState("");

  // Every keystroke restarts the timer, so only the pause after the last one
  // fires. Trimmed, so a trailing space does not search again.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(q.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let alive = true;
    setError("");
    setLoading(true);
    api
      .getListings({ q: query })
      .then((rows) => {
        if (alive) setListings(rows);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    // A slow earlier response must not overwrite a newer search.
    return () => {
      alive = false;
    };
  }, [query]);

  // Categories present in these results, for the filter row.
  const categories = useMemo(() => {
    const seen = new Set();
    for (const l of listings) if (l.category) seen.add(l.category);
    return [...seen].sort();
  }, [listings]);

  // Drop the active category if the new search has nothing in it. Not while
  // loading: the list is empty then, which would drop a category from the URL
  // before its listings arrive.
  useEffect(() => {
    if (!loading && category && !categories.includes(category)) setCategory(null);
  }, [categories, category, loading]);

  const shown = useMemo(
    () => (category ? listings.filter((l) => l.category === category) : listings),
    [listings, category]
  );

  // Counted over listings with photos only, so a run of photo-less listings
  // does not shift which tiles are the big ones.
  const tiles = useMemo(() => {
    let photos = 0;
    return shown.map((listing) => {
      const img = mediaUrl(listing.image_urls[0]);
      const featured = Boolean(img) && photos++ % FEATURE_EVERY === 0;
      const pin = pinOf(listing);
      const walk = position && pin ? formatWalkShort(distanceMiles(position, pin)) : null;
      return { listing, img, featured, walk };
    });
  }, [shown, position]);

  const anyPinned = shown.some((l) => pinOf(l));

  // Still typing, or the request is out: either way these results are stale.
  const searching = loading || q.trim() !== query;
  const summary = query
    ? `${shown.length} result${shown.length === 1 ? "" : "s"} for "${query}"`
    : `${shown.length} listing${shown.length === 1 ? "" : "s"} on campus`;

  return (
    <>
      <h1 className="sr-only">Search</h1>

      <div className="explore-search">
        <label htmlFor="explore-q" className="sr-only">
          Search listings
        </label>
        <SearchIcon />
        <input
          id="explore-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. tutoring, haircut, photography…"
          autoFocus
        />
      </div>

      {categories.length > 0 && (
        <div className="explore-chips" role="group" aria-label="Filter by category">
          <button
            className={`chip${category === null ? " on" : ""}`}
            aria-pressed={category === null}
            onClick={() => setCategory(null)}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={`chip${category === c ? " on" : ""}`}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {/* The previous results stay up while a new search runs, so typing does
          not flash the page empty on every keystroke. */}
      {loading && listings.length === 0 ? (
        <p className="muted">Searching…</p>
      ) : shown.length === 0 ? (
        <p className="empty">
          {query ? `Nothing matches "${query}" yet.` : "No listings yet."}
        </p>
      ) : (
        <>
          <div className="explore-count">
            <span aria-live="polite">{searching ? "Searching…" : summary}</span>
            {/* Asked for, never on load: an unprompted location dialog is hostile. */}
            {anyPinned && !position && status !== "denied" && status !== "unavailable" && (
              <button className="link-button" onClick={request} disabled={status === "loading"}>
                {status === "loading" ? "Locating…" : "Show walking times"}
              </button>
            )}
          </div>
          <ul className="explore-grid">
            {tiles.map(({ listing, img, featured, walk }) => (
              <li key={listing.id} className={featured ? "featured" : undefined}>
                <Link
                  className="explore-tile"
                  to={`/listings/${listing.id}`}
                  aria-label={[listing.title, `$${Number(listing.price).toFixed(2)}`, walk]
                    .filter(Boolean)
                    .join(", ")}
                >
                  {img ? (
                    <img src={img} alt="" loading="lazy" />
                  ) : (
                    <span className="explore-tile-title">{listing.title}</span>
                  )}
                  {walk && <span className="explore-tile-walk">{walk}</span>}
                  <span className="explore-tile-price">
                    ${Number(listing.price).toFixed(2)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
