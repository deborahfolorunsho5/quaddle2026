import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(identifier, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="page-narrow">
      <h1>Log in</h1>
      <form className="card-panel" onSubmit={onSubmit}>
        {error && <div className="error">{error}</div>}

        <div className="field">
          <label>Username or email</label>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="muted" style={{ textAlign: "center", marginTop: "1rem" }}>
        <Link to="/">Continue as guest</Link> · New here?{" "}
        <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}