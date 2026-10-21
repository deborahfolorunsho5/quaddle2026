import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
} from "react-router-dom";

import { api } from "./api/client";
import { MessageIcon } from "./components/icons";
import TabBar from "./components/TabBar";
import { useAuth } from "./context/AuthContext";
import { useCampus } from "./lib/campus";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import ListingDetailPage from "./pages/ListingDetailPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ListingFormPage from "./pages/ListingFormPage";
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
  const { user } = useAuth();
  const campus = useCampus();
  const location = useLocation();
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
        {user ? (
          <Link
            to="/messages"
            className="nav-icon"
            aria-label={unread > 0 ? `Messages, ${unread} unread` : "Messages"}
          >
            <MessageIcon />
            {unread > 0 && <span className="badge">{unread}</span>}
          </Link>
        ) : (
          // Both auth pages already link to each other, and returning to
          // either one after logging in would be a dead end.
          !["/login", "/signup"].includes(location.pathname) && (
            <Link
              to="/login"
              state={{ from: location.pathname + location.search }}
              className="nav-login"
            >
              Log in
            </Link>
          )
        )}
      </div>
    </header>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="muted">Loading…</p>;
  // Remember where they were headed so logging in lands them back there.
  return user ? (
    children
  ) : (
    <Navigate
      to="/login"
      replace
      state={{ from: location.pathname + location.search }}
    />
  );
}

// The Profile tab's target for guests, who have no id to link to until
// they log in.
function MyProfileRedirect() {
  const { user } = useAuth();
  return <Navigate to={`/users/${user.id}`} replace />;
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
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route
              path="/listings/new"
              element={
                <ProtectedRoute>
                  <ListingFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listings/:id/edit"
              element={
                <ProtectedRoute>
                  <ListingFormPage />
                </ProtectedRoute>
              }
            />
            <Route path="/listings/:id" element={<ListingDetailPage />} />
            <Route path="/users/:id" element={<ProfilePage />} />
            <Route
              path="/me"
              element={
                <ProtectedRoute>
                  <MyProfileRedirect />
                </ProtectedRoute>
              }
            />
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
      <TabBar />
    </>
  );
}
