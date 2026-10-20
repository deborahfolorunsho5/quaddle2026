import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import ListingCard from "../components/ListingCard";
import ListingsMap from "../components/ListingsMap";
import { useCampus } from "../lib/campus";
import { distanceMiles, pinOf } from "../lib/geo";
import { useMyLocation } from "../lib/useMyLocation";

export default function BrowsePage() {
  const campus = useCampus();
  const { position, status, request } = useMyLocation();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("newest");
  const [showMap, setShowMap] = useState(false);
  const [error, setError] = useState("");

  // No campus to choose: the API scopes a guest to the campus Quad is open
  // to, and a logged-in student to their own.
  useEffect(() => {
    let alive = true;
    api
      .getListings()
      .then((rows) => {
        if (alive) setListings(rows);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(() => {
    const measured = listings.map((listing) => {
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
  }, [listings, position, sort]);

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

      {error && <div className="error">{error}</div>}

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

      {anyPinned && status === "idle" && (
        <p className="hint" style={{ marginBottom: "1.25rem" }}>
          <button className="link-button" onClick={request}>
            Use my location
          </button>{" "}
          to see how far each listing is from you.
        </p>
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
          No listings yet. Be the first to post one.
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
