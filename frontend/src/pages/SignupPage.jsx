import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function SignupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [universities, setUniversities] = useState([]);
  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    full_name: "",
    university: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getUniversities().then(setUniversities).catch(() => {});
  }, []);

  // Map typed university name -> id (names are unique).
  const nameToId = useMemo(
    () => Object.fromEntries(universities.map((u) => [u.name, u.id])),
    [universities]
  );

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const university_id = nameToId[form.university];
    if (!university_id) {
      setError("Please pick your university from the list.");
      return;
    }
    setSubmitting(true);
    try {
      await register({
        username: form.username,
        password: form.password,
        university_id,
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
      <h1>Create your account</h1>
      <p className="muted">Join your campus marketplace.</p>
      <form className="card-panel" onSubmit={onSubmit}>
        {error && <div className="error">{error}</div>}

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
        </div>
        <div className="field">
          <label>University</label>
          <input
            list="universities"
            value={form.university}
            onChange={set("university")}
            placeholder="Start typing your school…"
            required
          />
          <datalist id="universities">
            {universities.map((u) => (
              <option key={u.id} value={u.name} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label>Email (optional)</label>
          <input type="email" value={form.email} onChange={set("email")} />
        </div>
        <div className="field">
          <label>Full name (optional)</label>
          <input value={form.full_name} onChange={set("full_name")} />
        </div>

        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p className="muted" style={{ textAlign: "center", marginTop: "1rem" }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}