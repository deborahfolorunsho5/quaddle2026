import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useCampus } from "../lib/campus";

export default function SignupPage() {
  const { register } = useAuth();
  const campus = useCampus();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    full_name: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!campus) {
      setError("Still loading the campus. Give it a second and try again.");
      return;
    }
    setSubmitting(true);
    try {
      await register({
        username: form.username,
        password: form.password,
        university_id: campus.id,
        email: form.email || null,
        full_name: form.full_name || null,
      });
      navigate("/");
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="page-narrow">
      <div className="page-head">
        <p className="eyebrow">Join Quad</p>
        <h1>Create your account</h1>
        <p className="page-sub">
          You need an account to post a listing, book someone, or leave a
          review.
        </p>
      </div>

      <form className="card-panel" onSubmit={onSubmit}>
        {error && <div className="error">{error}</div>}

        <div className="field">
          <label>Campus</label>
          <div className="field-locked">
            <span className="lock">Only campus</span>
            {campus ? campus.name : "Loading…"}
          </div>
          <p className="hint">
            Quad is open to one campus for now, so there is nothing to pick.
          </p>
        </div>
        <div className="field">
          <label>Username</label>
          <input value={form.username} onChange={set("username")} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={form.password}
            onChange={set("password")}
            required
            minLength={6}
          />
          <p className="hint">At least 6 characters.</p>
        </div>
        <div className="field">
          <label>Email (optional)</label>
          <input type="email" value={form.email} onChange={set("email")} />
        </div>
        <div className="field">
          <label>Full name (optional)</label>
          <input value={form.full_name} onChange={set("full_name")} />
        </div>

        <button
          className="btn btn-primary btn-block"
          disabled={submitting || !campus}
        >
          {submitting ? "Creating…" : "Sign up"}
        </button>
      </form>

      <p className="muted" style={{ textAlign: "center", marginTop: "1rem" }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
