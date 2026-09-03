import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

import { api, mediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Stars } from "../components/Stars";
import ListingsMap from "../components/ListingsMap";
import { distanceMiles, formatDistanceAndWalk, pinOf } from "../lib/geo";
import { useMyLocation } from "../lib/useMyLocation";

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { position, status, request } = useMyLocation();

  const [listing, setListing] = useState(null);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getListing(id)
      .then((l) => {
        setListing(l);
        return api.getUserProfile(l.owner.id);
      })
      .then(setOwnerProfile)
      .catch((err) => setError(err.message));
  }, [id]);

  // ListingsMap fits its view to the pins it is given, so the array it
  // receives has to keep a stable identity between renders.
  const asList = useMemo(() => (listing ? [listing] : []), [listing]);

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
  const pin = pinOf(listing);

  return (
    <>
      <Link to="/" className="back-link">
        Back to browse
      </Link>

      <article className="card-panel">
        {img && <img className="detail-hero" src={img} alt={listing.title} />}

        {listing.category && <p className="eyebrow">{listing.category}</p>}
        <div className="detail-head">
          <h1>{listing.title}</h1>
          <span className="detail-price">
            ${Number(listing.price).toFixed(2)}
          </span>
        </div>
        <p className="detail-desc">{listing.description}</p>

        {pin && (
          <section className="listing-location">
            <h2>Where you would meet</h2>
            {position ? (
              <p className="distance">
                {formatDistanceAndWalk(distanceMiles(position, pin))}
              </p>
            ) : status === "denied" || status === "unavailable" ? (
              <p className="muted">
                Share your location to see how far this is from you.
              </p>
            ) : (
              <button
                className="btn btn-ghost"
                onClick={request}
                disabled={status === "loading"}
              >
                {status === "loading" ? "Locating…" : "How far is this from me?"}
              </button>
            )}
            <ListingsMap listings={asList} me={position} />
            <p className="hint">
              {listing.location_is_approximate
                ? "This pin is the rough area, not the exact spot. "
                : ""}
              Walking times are straight-line estimates, so a real route may be
              longer.
            </p>
          </section>
        )}

        <div className="detail-owner">
          <span>
            Posted by{" "}
            <Link to={`/users/${listing.owner.id}`}>
              @{listing.owner.username}
            </Link>
          </span>
          {ownerProfile && <Stars value={ownerProfile.rating_average} />}
        </div>

        {isOwner && (
          <button className="btn btn-danger" onClick={onDelete}>
            Delete listing
          </button>
        )}
      </article>
    </>
  );
}
