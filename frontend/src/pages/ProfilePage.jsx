import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, mediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import AvailabilityEditor from "../components/AvailabilityEditor";
import BookingForm from "../components/BookingForm";
import Photo from "../components/Photo";
import ProfileEditor from "../components/ProfileEditor";
import { Stars, StarInput } from "../components/Stars";
import { formatDay } from "../lib/datetime";
import { distanceMiles, formatMiles, pinOf } from "../lib/geo";
import { useMyLocation } from "../lib/useMyLocation";

// Enough photos to show the range of someone's work without loading all of
// every listing's six.
const WORK_PHOTO_LIMIT = 12;

export default function ProfilePage() {
  const { id } = useParams();
  const userId = Number(id);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { position } = useMyLocation();

  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [listings, setListings] = useState(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState(false);

  // review form
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [role, setRole] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(() => {
    api.getUserProfile(userId).then(setProfile).catch((e) => setError(e.message));
    api.getReviews(userId).then(setReviews).catch(() => {});
    api
      .getListings({ owner_id: userId })
      .then(setListings)
      .catch(() => setListings([]));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const isMe = user?.id === userId;
  const alreadyReviewed = reviews.some((r) => user && r.author.id === user.id);
  const canReview = user && user.id !== userId && !alreadyReviewed;

  // Only an owner is sent their inactive listings, and nobody can book them.
  const bookable = useMemo(
    () => (listings ?? []).filter((l) => l.is_active),
    [listings]
  );

  const about = useMemo(() => {
    const categories = [...new Set(bookable.map((l) => l.category).filter(Boolean))];
    const distances = bookable
      .map((l) => pinOf(l))
      .filter(Boolean)
      .map((pin) => (position ? distanceMiles(position, pin) : null))
      .filter((m) => m != null);
    const nearest = distances.length ? Math.min(...distances) : null;
    const parts = [];
    if (categories.length) parts.push(categories.slice(0, 3).join(", "));
    // The closest of their meeting spots: each listing can have its own pin.
    if (nearest != null) parts.push(`${formatMiles(nearest)} away`);
    return parts.join(" · ");
  }, [bookable, position]);

  const work = useMemo(
    () =>
      bookable
        .flatMap((listing) => listing.image_urls.map((url) => ({ url, listing })))
        .slice(0, WORK_PHOTO_LIMIT),
    [bookable]
  );

  // How many reviews gave each star count, five first.
  const spread = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((stars) => ({
        stars,
        count: reviews.filter((r) => r.rating === stars).length,
      })),
    [reviews]
  );

  const submitReview = async (e) => {
    e.preventDefault();
    setFormError("");
    if (rating < 1) {
      setFormError("Pick a star rating.");
      return;
    }
    try {
      await api.createReview({
        subject_id: userId,
        rating,
        comment: comment || null,
        role: role || null,
      });
      setRating(0);
      setComment("");
      setRole("");
      load();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const removeReview = async (reviewId) => {
    await api.deleteReview(reviewId);
    load();
  };

  const message = async () => {
    setActionError("");
    try {
      const conversation = await api.startConversation(userId);
      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (error) return <div className="error">{error}</div>;
  if (!profile) return <p className="muted">Loading…</p>;

  return (
    <>
      <section className="profile-top">
        <div className="profile-head">
          {profile.avatar_url ? (
            <img
              className="avatar avatar-lg"
              src={mediaUrl(profile.avatar_url)}
              alt={`@${profile.username}`}
            />
          ) : (
            <div className="avatar avatar-lg">{profile.username.slice(0, 1)}</div>
          )}
          <div className="profile-id">
            <h1>@{profile.username}</h1>
            {profile.full_name && <p className="muted">{profile.full_name}</p>}
            <p className="rating-row">
              <Stars value={profile.rating_average} />
              {profile.rating_count > 0 && (
                <span className="muted">
                  {profile.rating_average} from {profile.rating_count} review
                  {profile.rating_count > 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
          {isMe && (
            <button
              className="btn btn-ghost profile-logout"
              onClick={() => {
                logout();
                navigate("/");
              }}
            >
              Log out
            </button>
          )}
        </div>

        {about && <p className="profile-about">{about}</p>}

        {actionError && <div className="error">{actionError}</div>}

        {isMe && !editing && (
          <div className="profile-actions">
            <button className="btn btn-ghost" type="button" onClick={() => setEditing(true)}>
              Edit profile
            </button>
          </div>
        )}

        {isMe && editing && (
          <ProfileEditor
            profile={profile}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              load();
            }}
          />
        )}

        {!isMe && (bookable.length > 0 || user) && (
          <div className="profile-actions">
            {bookable.length > 0 && (
              <a className="btn btn-primary" href="#book">
                Book a time
              </a>
            )}
            {user && (
              <button className="btn btn-ghost" type="button" onClick={message}>
                Message @{profile.username}
              </button>
            )}
          </div>
        )}
      </section>

      {work.length > 0 && (
        <section className="profile-section">
          <h2 className="home-head">Recent work</h2>
          <ul className="work-strip">
            {work.map(({ url, listing }, i) => (
              <li key={`${listing.id}-${i}`}>
                <Link to={`/listings/${listing.id}`}>
                  <Photo src={mediaUrl(url)} alt={`${listing.title}, photo`} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="profile-section">
        <h2 className="home-head">{isMe ? "Your listings" : "Services"}</h2>
        {listings === null ? (
          <p className="muted">Loading…</p>
        ) : listings.length === 0 ? (
          <p className="empty">
            {isMe ? "You have not posted anything yet." : "No listings yet."}
          </p>
        ) : (
          <ul className="service-list">
            {listings.map((listing) => {
              const img = mediaUrl(listing.image_urls[0]);
              return (
                <li key={listing.id}>
                  <Link className="service-row" to={`/listings/${listing.id}`}>
                    {img ? (
                      <Photo className="service-img" src={img} />
                    ) : (
                      <span className="service-img">No photo</span>
                    )}
                    <span className="service-body">
                      <span className="service-title">{listing.title}</span>
                      {!listing.is_active && (
                        <span className="card-hidden">Hidden from browse</span>
                      )}
                      <span className="service-desc">{listing.description}</span>
                    </span>
                    <span className="price">${Number(listing.price).toFixed(2)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isMe && (
        <section className="profile-section">
          <h2 className="home-head">Your availability</h2>
          <p className="page-sub" style={{ marginBottom: "1rem" }}>
            Students booking any of your listings pick from these times.
          </p>
          <AvailabilityEditor />
        </section>
      )}

      {!isMe && bookable.length > 0 && (
        <section className="profile-section" id="book">
          <h2 className="home-head">Book a time</h2>
          <p className="page-sub" style={{ margin: "-0.4rem 0 1rem" }}>
            Times @{profile.username} has opened. Pick one to request it.
          </p>
          {/* Keyed so moving to another profile starts a fresh form. */}
          <BookingForm
            key={userId}
            providerId={userId}
            providerName={profile.username}
            listings={bookable}
          />
        </section>
      )}

      <section className="profile-section">
        <h2 className="home-head">Reviews</h2>

        {reviews.length > 0 && (
          <div className="review-summary">
            <div className="review-score">
              <span className="review-average">
                {profile.rating_average?.toFixed(1)}
              </span>
              <Stars value={profile.rating_average} />
              <span className="muted">
                {reviews.length} review{reviews.length > 1 ? "s" : ""}
              </span>
            </div>
            <ul className="review-bars" aria-label="Reviews by star rating">
              {spread.map(({ stars, count }) => (
                <li key={stars}>
                  <span>{stars}</span>
                  <span className="review-bar">
                    <span style={{ width: `${(count / reviews.length) * 100}%` }} />
                  </span>
                  <span>{count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {reviews.length === 0 ? (
          <p className="empty">No reviews yet.</p>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="review">
              <div className="review-head">
                <Stars value={r.rating} />
                <strong>@{r.author.username}</strong>
                {r.role && <span className="muted">as {r.role}</span>}
                <span className="muted review-date">{formatDay(r.created_at)}</span>
              </div>
              {r.comment && <p>{r.comment}</p>}
              {user && r.author.id === user.id && (
                <button className="btn btn-danger" onClick={() => removeReview(r.id)}>
                  Delete
                </button>
              )}
            </div>
          ))
        )}

        {canReview && (
          <form className="card-panel review-form" onSubmit={submitReview}>
            <h2 style={{ marginBottom: "1rem" }}>Leave a review</h2>
            {formError && <div className="error">{formError}</div>}
            <div className="field">
              <label>Rating</label>
              <StarInput value={rating} onChange={setRating} />
            </div>
            <div className="field">
              <label>Comment (optional)</label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <div className="field">
              <label>You dealt with them as a… (optional)</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">No answer</option>
                <option value="provider">Provider (they offered a service)</option>
                <option value="customer">Customer (they booked from me)</option>
              </select>
            </div>
            <button className="btn btn-primary">Submit review</button>
          </form>
        )}
        {user && alreadyReviewed && (
          <p className="muted">You have already reviewed this person.</p>
        )}
        {!user && <p className="muted">Log in to leave a review.</p>}
      </section>
    </>
  );
}
