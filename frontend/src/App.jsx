import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { api } from "./api/client";
import { useAuth } from "./context/AuthContext";
import { useCampus } from "./lib/campus";
import BrowsePage from "./pages/BrowsePage";
import ListingDetailPage from "./pages/ListingDetailPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import CreateListingPage from "./pages/CreateListingPage";
import ProfilePage from "./pages/ProfilePage";
import AvailabilityPage from "./pages/AvailabilityPage";
import BookingsPage from "./pages/BookingsPage";
import MessagesPage from "./pages/MessagesPage";
import ConversationPage from "./pages/ConversationPage";

// No websocket to push on, so the badge asks. Also re-checked on every
// navigation, which is what makes it clear the moment you read a thread.
const UNREAD_POLL_MS = 20000;

function useUnreadCount(enabled) {
  const [count, setCount] = useState(0);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    let cancelled = false;
    const check = () =>
      api
        .getUnreadCount()
        .then(({ count: n }) => !cancelled && setCount(n))
        .catch(() => {});

    check();
    const timer = setInterval(check, UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, pathname]);

  return count;
}

function Nav() {
  const { user, logout } = useAuth();
  const campus = useCampus();
  const navigate = useNavigate();
  const unread = useUnreadCount(Boolean(user));

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
            <>
              <NavLink to="/listings/new" className="nav-link">
                Post a listing
              </NavLink>
              <NavLink to="/bookings" className="nav-link">
                Bookings
              </NavLink>
              <NavLink to="/messages" className="nav-link">
                Messages
                {unread > 0 && <span className="badge">{unread}</span>}
              </NavLink>
            </>
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
            <Route
              path="/availability"
              element={
                <ProtectedRoute>
                  <AvailabilityPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookings"
              element={
                <ProtectedRoute>
                  <BookingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <MessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages/:id"
              element={
                <ProtectedRoute>
                  <ConversationPage />
                </ProtectedRoute>
              }
            />
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
