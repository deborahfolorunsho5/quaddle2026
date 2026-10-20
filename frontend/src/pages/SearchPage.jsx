import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import ListingCard from "../components/ListingCard";
import { distanceMiles, pinOf } from "../lib/geo";
import { useMyLocation } from "../lib/useMyLocation";

export default function SearchPage() {
  const { position } = useMyLocation();

  const [q, setQ] = useState("");
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(null);
  const [error, setError] = useState("");

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

  // Categories present in these results, for the filter row.
  const categories = useMemo(() => {
    const seen = new Set();
    for (const l of listings) if (l.category) seen.add(l.category);
    return [...seen].sort();
  }, [listings]);

  // Drop the active category if the new search has nothing in it.
  useEffect(() => {
    if (category && !categories.includes(category)) setCategory(null);
  }, [categories, category]);

  const shown = category
    ? listings.filter((l) => l.category === category)
    : listings;

  return (
    <>
      <div className="page-head">
        <h1>Search</h1>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Search listings</label>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. tutoring, haircut, photography…"
            autoFocus
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

      {loading ? (
        <p className="muted">Searching…</p>
      ) : shown.length === 0 ? (
        <p className="empty">
          {q ? `Nothing matches "${q}" yet.` : "No listings yet."}
        </p>
      ) : (
        <div className="grid">
          {shown.map((listing) => {
            const pin = pinOf(listing);
            return (
              <ListingCard
                key={listing.id}
                listing={listing}
                miles={position && pin ? distanceMiles(position, pin) : null}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
