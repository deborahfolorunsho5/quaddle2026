import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

import { api, mediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Stars } from "../components/Stars";
import ListingsMap from "../components/ListingsMap";
import SlotPicker from "../components/SlotPicker";
import { formatDay, formatWhen } from "../lib/datetime";
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

  const [slots, setSlots] = useState(null);
  const [slotId, setSlotId] = useState(null);
  const [note, setNote] = useState("");
  const [booked, setBooked] = useState(null);
  const [bookingError, setBookingError] = useState("");
  const [busy, setBusy] = useState(false);

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
    api
      .getAvailability(ownerId)
      .then((open) => !cancelled && setSlots(open))
      .catch((err) => {
        if (cancelled) return;
        setSlots([]);
        setBookingError(err.message);
      });
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

  const refreshSlots = async () => {
    try {
      setSlots(await api.getAvailability(ownerId));
    } catch {
      // Keep whatever the picker already has rather than emptying it.
    }
  };

  const requestBooking = async (e) => {
    e.preventDefault();
    if (!slotId) {
      setBookingError("Pick a time first.");
      return;
    }

    setBusy(true);
    setBookingError("");
    try {
      const created = await api.createBooking({
        listing_id: listing.id,
        slot_id: slotId,
        message: note.trim() || null,
      });
      setBooked(created);
      setSlotId(null);
      setNote("");
    } catch (err) {
      // Most likely someone took the slot first, so reload before they retry.
      setBookingError(err.message);
    } finally {
      await refreshSlots();
      setBusy(false);
    }
  };

  const messageOwner = async () => {
    setBookingError("");
    try {
      const conversation = await api.startConversation(ownerId);
      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      setBookingError(err.message);
    }
  };

  if (error) return <div className="error">{error}</div>;
  if (!listing) return <p className="muted">Loading…</p>;

  const img = mediaUrl(listing.image_url);
  const isOwner = user && user.id === listing.owner.id;
  const pin = pinOf(listing);
  const hasOpenings = slots !== null && slots.length > 0;

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

          {bookingError && <div className="error">{bookingError}</div>}

          {isOwner ? (
            <p className="muted">
              This is your listing.{" "}
              <Link to="/availability">Open the times you are free</Link> and
              students can book them here.
            </p>
          ) : booked ? (
            <div className="booking-done">
              <p>
                Requested for{" "}
                <strong>
                  {formatWhen(booked.requested_time, booked.requested_end)}
                </strong>
                . @{listing.owner.username} has to accept it.
              </p>
              <div className="booking-actions">
                <Link className="btn btn-ghost" to="/bookings">
                  See your bookings
                </Link>
                <button className="btn-link" type="button" onClick={messageOwner}>
                  Message @{listing.owner.username}
                </button>
              </div>
            </div>
          ) : slots === null ? (
            <p className="muted">Loading times…</p>
          ) : !hasOpenings ? (
            <>
              <p className="empty">
                @{listing.owner.username} has not opened any times yet.
              </p>
              {user && (
                <button className="btn btn-ghost" type="button" onClick={messageOwner}>
                  Message @{listing.owner.username}
                </button>
              )}
            </>
          ) : (
            <form onSubmit={requestBooking}>
              <SlotPicker
                slots={slots}
                value={slotId}
                onChange={setSlotId}
                disabled={!user || busy}
              />

              {user ? (
                <>
                  <div className="field booking-note-field">
                    <label htmlFor="booking-note">
                      Anything they should know (optional)
                    </label>
                    <textarea
                      id="booking-note"
                      rows={3}
                      maxLength={1000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                  <div className="booking-actions">
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={busy || !slotId}
                    >
                      {busy ? "Requesting…" : "Request this time"}
                    </button>
                    <button
                      className="btn-link"
                      type="button"
                      onClick={messageOwner}
                    >
                      Message @{listing.owner.username}
                    </button>
                  </div>
                </>
              ) : (
                <p className="hint">
                  <Link to="/login">Log in</Link> to book one of these times or
                  message @{listing.owner.username}.
                </p>
              )}
            </form>
          )}
        </section>

        {isOwner && (
          <button className="btn btn-danger" onClick={onDelete}>
            Delete listing
          </button>
        )}
      </article>
    </>
  );
}
