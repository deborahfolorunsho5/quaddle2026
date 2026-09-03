import { Routes, Route, Link, NavLink, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import { useCampus } from "./lib/campus";
import BrowsePage from "./pages/BrowsePage";
import ListingDetailPage from "./pages/ListingDetailPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import CreateListingPage from "./pages/CreateListingPage";
import ProfilePage from "./pages/ProfilePage";

function Nav() {
  const { user, logout } = useAuth();
  const campus = useCampus();
  const navigate = useNavigate();

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand">
          <span className="brand-name">Quad</span>
          <span className="brand-sub">
            {campus ? campus.name : "Campus marketplace"}
          </span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end className="nav-link">
            Browse
          </NavLink>
          {user && (
            <NavLink to="/listings/new" className="nav-link">
              Post a listing
            </NavLink>
          )}
          {user ? (
            <>
              <Link to={`/users/${user.id}`} className="nav-me">
                @{user.username}
              </Link>
              <button
                className="btn btn-onnavy"
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
              <NavLink to="/login" className="nav-link">
                Log in
              </NavLink>
              <Link to="/signup" className="btn btn-accent">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const campus = useCampus();
  return (
    <footer className="site-footer">
      <div>
        Quad is a student-run marketplace
        {campus ? ` for ${campus.name}` : ""}. Browsing is open to everyone;
        posting, booking, and reviewing need an account.
      </div>
    </footer>
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
            <Route path="/users/:id" element={<ProfilePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
      <Footer />
    </>
  );
}
