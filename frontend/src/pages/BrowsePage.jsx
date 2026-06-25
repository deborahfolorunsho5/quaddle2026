import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, mediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";

function ListingCard({ listing }) {
  const img = mediaUrl(listing.image_url);
  return (
    <Link to={`/listings/${listing.id}`} className="card">
      {img ? (
        <img className="card-img" src={img} alt={listing.title} />
      ) : (
        <div className="card-img placeholder">No photo</div>
      )}
      <div className="card-body">
        <p className="card-title">{listing.title}</p>
        <span className="price">${Number(listing.price).toFixed(2)}</span>
        {listing.category && (
          <span className="muted"> · {listing.category}</span>
        )}
      </div>
    </Link>
  );
}

export default function BrowsePage() {
  const { user } = useAuth();

  const [universities, setUniversities] = useState([]);
  const [campusName, setCampusName] = useState("");
  const [campusId, setCampusId] = useState(user?.university_id ?? null);
  const [q, setQ] = useState("");
  const [listings, setListings] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getUniversities().then(setUniversities).catch(() => {});
  }, []);

  const idToName = useMemo(
    () => Object.fromEntries(universities.map((u) => [u.id, u.name])),
    [universities]
  );
  const nameToId = useMemo(
    () => Object.fromEntries(universities.map((u) => [u.name, u.id])),
    [universities]
  );

  // Keep the campus text box in sync with the active campus id.
  useEffect(() => {
    if (campusId && idToName[campusId]) setCampusName(idToName[campusId]);
  }, [campusId, idToName]);

  // Fetch listings whenever campus or search changes.
  useEffect(() => {
    if (!campusId) {
      setListings([]);
      return;
    }
    setError("");
    api
      .getListings({ university_id: campusId, q })
      .then(setListings)
      .catch((err) => setError(err.message));
  }, [campusId, q]);

  const onCampusChange = (e) => {
    const name = e.target.value;
    setCampusName(name);
    if (nameToId[name]) setCampusId(nameToId[name]);
  };

  return (
    <>
      <h1>Browse listings</h1>

      <div className="toolbar">
        <div className="field" style={{ flex: "1 1 240px" }}>
          <label>Campus</label>
          <input
            list="campus-list"
            value={campusName}
            onChange={onCampusChange}
            placeholder="Pick a campus…"
          />
          <datalist id="campus-list">
            {universities.map((u) => (
              <option key={u.id} value={u.name} />
            ))}
          </datalist>
        </div>
        <div className="field" style={{ flex: "2 1 240px" }}>
          <label>Search</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. tutoring, haircut…"
          />
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {!campusId ? (
        <p className="empty">Pick a campus above to see what students offer.</p>
      ) : listings.length === 0 ? (
        <p className="empty">No listings yet on this campus. Be the first!</p>
      ) : (
        <div className="grid">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </>
  );
}