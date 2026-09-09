import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { formatStamp } from "../lib/datetime";

// The backend is deliberately synchronous, so there is no websocket to hang a
// live thread off. Polling for messages newer than the last id we hold is
// cheap enough: an idle thread answers with an empty list.
const POLL_MS = 5000;

export default function ConversationPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const lastIdRef = useRef(0);
  const endRef = useRef(null);

  const absorb = (batch) => {
    if (!batch.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = batch.filter((m) => !seen.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    lastIdRef.current = Math.max(lastIdRef.current, batch[batch.length - 1].id);
  };

  useEffect(() => {
    let cancelled = false;
    setConversation(null);
    setMessages([]);
    setError("");
    lastIdRef.current = 0;

    api
      .getConversation(id)
      .then((c) => !cancelled && setConversation(c))
      .catch((err) => !cancelled && setError(err.message));

    api
      .getMessages(id)
      .then((batch) => {
        if (cancelled) return;
        setMessages(batch);
        lastIdRef.current = batch.length ? batch[batch.length - 1].id : 0;
        return api.markConversationRead(id);
      })
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const batch = await api.getMessages(id, lastIdRef.current || undefined);
        if (!batch.length) return;
        absorb(batch);
        await api.markConversationRead(id);
      } catch {
        // A dropped poll is not worth a banner; the next one picks it up.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setError("");
    try {
      absorb([await api.sendMessage(id, body)]);
      setDraft("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Link to="/messages" className="back-link">
        Back to messages
      </Link>

      <div className="page-head">
        <h1>
          {conversation ? `@${conversation.other_user.username}` : "Loading…"}
        </h1>
        {conversation && (
          <p className="page-sub">
            <Link to={`/users/${conversation.other_user.id}`}>
              See their profile
            </Link>
          </p>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="thread">
        {messages.length === 0 ? (
          <p className="muted thread-empty">
            No messages yet. Say hello and ask about a time.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`bubble-row ${
                m.sender_id === user.id ? "bubble-mine" : "bubble-theirs"
              }`}
            >
              <div className="bubble">
                <p className="bubble-body">{m.body}</p>
                <span className="bubble-stamp">{formatStamp(m.created_at)}</span>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={send}>
        <label className="sr-only" htmlFor="composer-body">
          Your message
        </label>
        <textarea
          id="composer-body"
          rows={2}
          maxLength={2000}
          placeholder="Write a message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={sending || !draft.trim()}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </>
  );
}
