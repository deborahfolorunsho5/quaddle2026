import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import BrowsePage from "./pages/BrowsePage";
import ListingDetailPage from "./pages/ListingDetailPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import CreateListingPage from "./pages/CreateListingPage";

function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="nav">
      <Link to="/" className="brand">
        Quaddle
      </Link>
      <nav className="nav-links">
        <Link to="/">Browse</Link>
        {user && <Link to="/listings/new">Post a listing</Link>}
        {user ? (
          <>
            <span className="muted">@{user.username}</span>
            <button
              className="btn btn-ghost"
              onClick={() => {
                logout();
                navigate("/");
              }}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/signup" className="btn btn-primary">
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted">Loading…</p>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { loading } = useAuth();

  return (
    <>
      <Nav />
      <main className="container">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <Routes>
            <Route path="/" element={<BrowsePage />} />
            <Route
              path="/listings/new"
              element={
                <ProtectedRoute>
                  <CreateListingPage />
                </ProtectedRoute>
              }
            />
            <Route path="/listings/:id" element={<ListingDetailPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </>
  );
}