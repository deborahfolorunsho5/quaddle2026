import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import BookingForm from "../components/BookingForm";
import { Stars } from "../components/Stars";
import ListingsMap from "../components/ListingsMap";
import PhotoGallery from "../components/PhotoGallery";
import { formatDay } from "../lib/datetime";
import { distanceMiles, formatDistanceAndWalk, pinOf } from "../lib/geo";
import { useMyLocation } from "../lib/useMyLocation";

// Enough to judge someone without turning the listing into their profile.
const REVIEW_PREVIEW = 3;

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { position, status, request } = useMyLocation();

  const [listing, setListing] = useState(null);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
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

  const ownerId = listing?.owner.id;

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    // Reviews are context, not the point of the page, so a failure here leaves
    // the listing usable rather than replacing it with an error.
    api
      .getReviews(ownerId)
      .then((r) => !cancelled && setReviews(r))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

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

  const isOwner = user && user.id === listing.owner.id;
  const pin = pinOf(listing);

  return (
    <>
      <Link to="/" className="back-link">
        Back to browse
      </Link>

      <article className="card-panel">
        <PhotoGallery urls={listing.image_urls} title={listing.title} />

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

        <section className="detail-seller">
          <h2>
            Posted by{" "}
            <Link to={`/users/${listing.owner.id}`}>
              @{listing.owner.username}
            </Link>
          </h2>

          {ownerProfile && (
            <p className="rating-row">
              <Stars value={ownerProfile.rating_average} />
              {ownerProfile.rating_count > 0 && (
                <span className="muted">
                  {ownerProfile.rating_average} from {ownerProfile.rating_count}{" "}
                  review{ownerProfile.rating_count > 1 ? "s" : ""}
                </span>
              )}
            </p>
          )}

          {reviews.length === 0 ? (
            <p className="muted">No reviews yet.</p>
          ) : (
            <>
              {reviews.slice(0, REVIEW_PREVIEW).map((r) => (
                <div key={r.id} className="review">
                  <div className="review-head">
                    <Stars value={r.rating} />
                    <strong>@{r.author.username}</strong>
                    {r.role && <span className="muted">as {r.role}</span>}
                    <span className="muted review-date">
                      {formatDay(r.created_at)}
                    </span>
                  </div>
                  {r.comment && <p>{r.comment}</p>}
                </div>
              ))}
              {reviews.length > REVIEW_PREVIEW && (
                <Link to={`/users/${listing.owner.id}`}>
                  Read all {reviews.length} reviews
                </Link>
              )}
            </>
          )}
        </section>

        <section className="listing-booking">
          <h2>Book a time</h2>

          {isOwner ? (
            <p className="muted">
              This is your listing.{" "}
              <Link to="/availability">Open the times you are free</Link> and
              students can book them here.
            </p>
          ) : (
            <BookingForm
              key={listing.id}
              providerId={listing.owner.id}
              providerName={listing.owner.username}
              listings={[listing]}
            />
          )}
        </section>

        {isOwner && (
          <div className="owner-actions">
            <Link className="btn btn-ghost" to={`/listings/${listing.id}/edit`}>
              Edit listing
            </Link>
            <button className="btn btn-danger" onClick={onDelete}>
              Delete listing
            </button>
          </div>
        )}
      </article>
    </>
  );
}
