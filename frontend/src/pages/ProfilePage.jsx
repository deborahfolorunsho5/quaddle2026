import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Stars, StarInput } from "../components/Stars";

export default function ProfilePage() {
  const { id } = useParams();
  const userId = Number(id);
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState("");

  // review form
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [role, setRole] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(() => {
    api.getUserProfile(userId).then(setProfile).catch((e) => setError(e.message));
    api.getReviews(userId).then(setReviews).catch(() => {});
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const alreadyReviewed = reviews.some((r) => user && r.author.id === user.id);
  const canReview = user && user.id !== userId && !alreadyReviewed;

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

  if (error) return <div className="error">{error}</div>;
  if (!profile) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1 style={{ marginBottom: 0 }}>@{profile.username}</h1>
      {profile.full_name && <p className="muted">{profile.full_name}</p>}
      <p>
        <Stars value={profile.rating_average} />{" "}
        {profile.rating_count > 0 && (
          <span className="muted">
            {profile.rating_average} · {profile.rating_count} review
            {profile.rating_count > 1 ? "s" : ""}
          </span>
        )}
      </p>

      {canReview && (
        <form className="card-panel" onSubmit={submitReview} style={{ margin: "1.5rem 0" }}>
          <h3 style={{ marginTop: 0 }}>Leave a review</h3>
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
              <option value="">—</option>
              <option value="provider">Provider (they offered a service)</option>
              <option value="customer">Customer (they booked from me)</option>
            </select>
          </div>
          <button className="btn btn-primary">Submit review</button>
        </form>
      )}
      {user && alreadyReviewed && (
        <p className="muted">You've already reviewed this person.</p>
      )}
      {!user && <p className="muted">Log in to leave a review.</p>}

      <h2>Reviews</h2>
      {reviews.length === 0 ? (
        <p className="empty">No reviews yet.</p>
      ) : (
        reviews.map((r) => (
          <div key={r.id} className="card-panel" style={{ marginBottom: "0.75rem" }}>
            <Stars value={r.rating} />{" "}
            <strong>@{r.author.username}</strong>
            {r.role && <span className="muted"> · as {r.role}</span>}
            {r.comment && <p style={{ marginBottom: 0 }}>{r.comment}</p>}
            {user && r.author.id === user.id && (
              <button
                className="btn btn-ghost"
                style={{ color: "var(--danger)", paddingLeft: 0 }}
                onClick={() => removeReview(r.id)}
              >
                Delete
              </button>
            )}
          </div>
        ))
      )}
    </>
  );
}