import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import { formatStamp } from "../lib/datetime";

export default function MessagesPage() {
  const [conversations, setConversations] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getConversations()
      .then(setConversations)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (conversations === null) return <p className="muted">Loading…</p>;

  return (
    <>
      <div className="page-head">
        <h1>Messages</h1>
        <p className="page-sub">
          Your conversations with other students on campus.
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="empty">
          <p>No conversations yet.</p>
          <p>
            Found someone you want to book? Tap Message on their listing or
            profile to ask a question first.
          </p>
          <Link className="btn btn-primary" to="/search">
            Find someone
          </Link>
        </div>
      ) : (
        <ul className="thread-list">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link className="thread-row" to={`/messages/${c.id}`}>
                <span className="thread-who">@{c.other_user.username}</span>
                <span className="thread-preview">
                  {c.last_message ?? "No messages yet"}
                </span>
                <span className="thread-meta">
                  {c.last_message_at && (
                    <span className="thread-stamp">
                      {formatStamp(c.last_message_at)}
                    </span>
                  )}
                  {c.unread_count > 0 && (
                    <span className="badge">{c.unread_count}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
