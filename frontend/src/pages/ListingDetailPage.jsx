import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

import { api, mediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [listing, setListing] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getListing(id)
      .then(setListing)
      .catch((err) => setError(err.message));
  }, [id]);

  const onDelete = async () => {
    if (!confirm("Delete this listing?")) return;
    try {
      await api.deleteListing(id);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  if (error) return <div className="error">{error}</div>;
  if (!listing) return <p className="muted">Loading…</p>;

  const img = mediaUrl(listing.image_url);
  const isOwner = user && user.id === listing.owner.id;

  return (
    <article className="card-panel">
      <Link to="/" className="muted">
        ← Back to browse
      </Link>
      {img && (
        <img
          src={img}
          alt={listing.title}
          style={{ width: "100%", borderRadius: 12, margin: "1rem 0" }}
        />
      )}
      <h1 style={{ marginBottom: "0.25rem" }}>{listing.title}</h1>
      <p className="price" style={{ fontSize: "1.3rem" }}>
        ${Number(listing.price).toFixed(2)}
      </p>
      {listing.category && <p className="muted">Category: {listing.category}</p>}
      <p style={{ whiteSpace: "pre-wrap", marginTop: "1rem" }}>
        {listing.description}
      </p>
      <p className="muted" style={{ marginTop: "1.5rem" }}>
        Posted by @{listing.owner.username}
      </p>

      {isOwner && (
        <button
          className="btn btn-ghost"
          style={{ color: "var(--danger)", paddingLeft: 0 }}
          onClick={onDelete}
        >
          Delete listing
        </button>
      )}
    </article>
  );
}