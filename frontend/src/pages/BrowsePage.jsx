import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, mediaUrl } from "../api/client";
import ListingsMap from "../components/ListingsMap";
import { useCampus } from "../lib/campus";
import { distanceMiles, formatWalk, pinOf } from "../lib/geo";
import { useMyLocation } from "../lib/useMyLocation";

function ListingCard({ listing, miles }) {
  const img = mediaUrl(listing.image_url);
  return (
    <Link to={`/listings/${listing.id}`} className="card">
      {img ? (
        <img className="card-img" src={img} alt={listing.title} />
      ) : (
        <div className="card-img placeholder">No photo</div>
      )}
      <div className="card-body">
        {listing.category && <p className="eyebrow">{listing.category}</p>}
        <p className="card-title">{listing.title}</p>
        <p className="card-desc">{listing.description}</p>
        {miles != null && <p className="card-walk">{formatWalk(miles)}</p>}
        <div className="card-foot">
          <span className="price">${Number(listing.price).toFixed(2)}</span>
          {listing.owner && (
            <span className="card-by">@{listing.owner.username}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function BrowsePage() {
  const campus = useCampus();
  const { position, status, request } = useMyLocation();

  const [q, setQ] = useState("");
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(null);
  const [sort, setSort] = useState("newest");
  const [showMap, setShowMap] = useState(false);
  const [error, setError] = useState("");

  // No campus to choose: the API scopes a guest to the campus Quad is open
  // to, and a logged-in student to their own.
  useEffect(() => {
    let alive = true;
    setError("");
    setLoading(true);
    api
      .getListings({ q })
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
  }, [q]);

  // Categories present on this campus, for the filter row.
  const categories = useMemo(() => {
    const seen = new Set();
    for (const l of listings) if (l.category) seen.add(l.category);
    return [...seen].sort();
  }, [listings]);

  // Drop the active category if it's no longer on this campus.
  useEffect(() => {
    if (category && !categories.includes(category)) setCategory(null);
  }, [categories, category]);

  const shown = useMemo(() => {
    const filtered = category
      ? listings.filter((l) => l.category === category)
      : listings;
    const measured = filtered.map((listing) => {
      const pin = pinOf(listing);
      return {
        listing,
        miles: position && pin ? distanceMiles(position, pin) : null,
      };
    });
    if (sort !== "nearest") return measured;
    // A listing with no pin cannot be ranked by distance, so it sinks to the
    // bottom rather than posing as the closest thing on campus.
    return [...measured].sort((a, b) => {
      if (a.miles == null) return b.miles == null ? 0 : 1;
      if (b.miles == null) return -1;
      return a.miles - b.miles;
    });
  }, [listings, category, position, sort]);

  // Stable identity for ListingsMap, which fits its view to these pins.
  const shownListings = useMemo(() => shown.map((x) => x.listing), [shown]);

  const sortNearest = () => {
    setSort("nearest");
    if (!position) request();
  };

  const anyPinned = shown.some(({ listing }) => pinOf(listing));
  const locationOff = status === "denied" || status === "unavailable";

  return (
    <>
      <div className="page-head">
        <p className="eyebrow">Campus marketplace</p>
        <h1>What students offer on campus</h1>
        <p className="page-sub">
          {campus
            ? `Every listing is posted by a ${campus.name} student, so whoever you book is a walk away.`
            : "Every listing is posted by a student on your campus, so whoever you book is a walk away."}
        </p>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Search listings</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. tutoring, haircut, photography…"
          />
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {categories.length > 0 && (
        <div className="chips">
          <button
            className={`chip${category === null ? " on" : ""}`}
            onClick={() => setCategory(null)}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={`chip${category === c ? " on" : ""}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {anyPinned && (
        <div className="viewbar">
          <div className="chips">
            <button
              className={`chip${sort === "newest" ? " on" : ""}`}
              onClick={() => setSort("newest")}
            >
              Newest
            </button>
            <button
              className={`chip${sort === "nearest" ? " on" : ""}`}
              onClick={sortNearest}
            >
              {status === "loading" ? "Locating…" : "Nearest"}
            </button>
          </div>
          <button className="chip" onClick={() => setShowMap((v) => !v)}>
            {showMap ? "Show list" : "Show map"}
          </button>
        </div>
      )}

      {anyPinned && locationOff && (
        <p className="hint" style={{ marginBottom: "1.25rem" }}>
          Location is off, so walking times are hidden. Turn it on in your
          browser to see how far each listing is.
        </p>
      )}

      {loading ? (
        <p className="muted">Loading listings…</p>
      ) : shown.length === 0 ? (
        <p className="empty">
          {q
            ? `Nothing matches "${q}" yet.`
            : "No listings yet. Be the first to post one."}
        </p>
      ) : showMap && anyPinned ? (
        <ListingsMap listings={shownListings} me={position} />
      ) : (
        <div className="grid">
          {shown.map(({ listing, miles }) => (
            <ListingCard key={listing.id} listing={listing} miles={miles} />
          ))}
        </div>
      )}
    </>
  );
}
