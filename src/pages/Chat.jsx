import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { getSocket, destroySocket } from "../lib/socket.js";
import api, { apiErrorMessage } from "../lib/api.js";
import ConfirmModal from "../components/ConfirmModal.jsx";

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Tick({ delivery, isOwn }) {
  if (!isOwn) return null;
  const seen = delivery?.seen_count > 0;
  const delivered = delivery?.delivered_count > 0;

  if (seen) {
    return <span className="tick tick-seen">✓✓</span>;
  }
  if (delivered) {
    return <span className="tick tick-delivered">✓✓</span>;
  }
  return <span className="tick tick-sent">✓</span>;
}

export default function Chat() {
  const { user, logout } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [infoTarget, setInfoTarget] = useState(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const socketRef = useRef(null);
  const manualDisconnectRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const bottomRef = useRef(null);

  // ------------------------------------------------
  // Load history + connect socket
  // ------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const { data } = await api.get("/messages");
        if (!cancelled) setMessages(data);
      } catch (error) {
        pushToast(apiErrorMessage(error), "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHistory();

    const socket = getSocket();
    socketRef.current = socket;
    manualDisconnectRef.current = false;

    const token = localStorage.getItem("nudge_token");
    socket.connect();
    socket.emit("join_chat", { token });

    socket.on("online_users", (names) => setOnlineUsers(names));

    socket.on("receive_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.sender_name !== user?.name) {
        socket.emit("mark_seen", { id: msg.id });
      }
    });

    socket.on("message_delivery_update", ({ message_id, ...info }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === message_id ? { ...m, delivery_info: info } : m))
      );
    });

    socket.on("message_edited", (updated) => {
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
    });

    socket.on("message_deleted", (updated) => {
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
    });

    socket.on("user_typing", ({ name }) => {
      if (name === user?.name) return;
      setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
    });

    socket.on("user_stop_typing", ({ name }) => {
      setTypingUsers((prev) => prev.filter((n) => n !== name));
    });

    socket.on("auth_error", () => {
      handleSessionExpired();
    });

    socket.on("disconnect", (reason) => {
      if (manualDisconnectRef.current) return;
      handleSessionExpired();
    });

    return () => {
      cancelled = true;
      manualDisconnectRef.current = true;
      socket.off("online_users");
      socket.off("receive_message");
      socket.off("message_delivery_update");
      socket.off("message_edited");
      socket.off("message_deleted");
      socket.off("user_typing");
      socket.off("user_stop_typing");
      socket.off("auth_error");
      socket.off("disconnect");
      // Leaving the chat page (e.g. back to dashboard) without logging out --
      // disconnect cleanly so the online users list updates for everyone else.
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mark existing unseen messages as seen once history + socket are ready
  useEffect(() => {
    if (loading || !socketRef.current) return;
    messages.forEach((m) => {
      if (m.sender_name !== user?.name && !m.deleted) {
        socketRef.current.emit("mark_seen", { id: m.id });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingUsers.length]);

  function handleSessionExpired() {
    manualDisconnectRef.current = true;
    pushToast("Session expired, please log in again", "error");
    destroySocket();
    logout();
    navigate("/login");
  }

  // ------------------------------------------------
  // Compose + typing
  // ------------------------------------------------
  function handleInputChange(e) {
    const val = e.target.value;
    setInput(val);

    const socket = socketRef.current;
    if (!socket) return;

    if (val.trim() && !isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("typing", { name: user.name });
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("stop_typing", { name: user.name });
    }, 1500);

    if (!val.trim()) {
      isTypingRef.current = false;
      socket.emit("stop_typing", { name: user.name });
    }
  }

  function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    socketRef.current?.emit("send_message", {
      sender_name: user.name,
      message: text,
    });

    setInput("");
    clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    socketRef.current?.emit("stop_typing", { name: user.name });
  }

  // ------------------------------------------------
  // Edit / delete
  // ------------------------------------------------
  function startEdit(msg) {
    setEditingId(msg.id);
    setEditText(msg.message);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  function saveEdit(e) {
    e.preventDefault();
    const text = editText.trim();
    if (!text) return;
    socketRef.current?.emit("edit_message", {
      id: editingId,
      message: text,
      sender_name: user.name,
    });
    setEditingId(null);
    setEditText("");
  }

  function confirmDelete() {
    socketRef.current?.emit("delete_message", {
      id: deleteTarget,
      sender_name: user.name,
    });
    setDeleteTarget(null);
  }

  function handleLogout() {
    manualDisconnectRef.current = true;
    destroySocket();
    logout();
    setLogoutConfirmOpen(false);
    pushToast("Logged out", "info");
    navigate("/login");
  }

  const infoMessage = useMemo(
    () => messages.find((m) => m.id === infoTarget),
    [messages, infoTarget]
  );

  return (
    <div className="chat-shell">
      <header className="chat-topbar">
        <div className="chat-brand">
          <span className="brand-dot" />
          Nudge
        </div>

        <button className="online-pill" onClick={() => setSidebarOpen((o) => !o)}>
          <span className="status-dot online" />
          {onlineUsers.length} online
        </button>

        <div className="chat-topbar-right">
          <span className="you-as">
            You as <strong>{user?.name}</strong>
          </span>
          <button className="btn btn-outline btn-sm" onClick={() => setLogoutConfirmOpen(true)}>
            Logout
          </button>
        </div>
      </header>

      <div className="chat-body">
        <aside className={`chat-sidebar ${sidebarOpen ? "open" : ""}`}>
          <h4>Online now</h4>
          <ul className="online-list">
            {onlineUsers.map((name) => (
              <li key={name}>
                <span className="avatar-mini">{name[0]?.toUpperCase()}</span>
                {name}
                {name === user?.name && <span className="you-tag">you</span>}
              </li>
            ))}
            {onlineUsers.length === 0 && <li className="muted">No one online</li>}
          </ul>
        </aside>

        <main className="chat-main">
          <div className="message-list">
            {loading && <div className="muted center-pad">Loading messages…</div>}

            {!loading &&
              messages.map((msg) => {
                const isOwn = msg.sender_name === user?.name;
                return (
                  <div key={msg.id} className={`message-row ${isOwn ? "own" : ""}`}>
                    <div className="message-bubble">
                      {!isOwn && <div className="bubble-sender">{msg.sender_name}</div>}

                      {msg.deleted ? (
                        <div className="bubble-deleted">Deleted by {msg.deleted_by}</div>
                      ) : editingId === msg.id ? (
                        <form className="edit-form" onSubmit={saveEdit}>
                          <input
                            autoFocus
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                          />
                          <div className="edit-actions">
                            <button type="button" className="btn btn-ghost btn-xs" onClick={cancelEdit}>
                              Cancel
                            </button>
                            <button type="submit" className="btn btn-primary btn-xs">
                              Save
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="bubble-text">{msg.message}</div>
                      )}

                      {!msg.deleted && (
                        <div className="bubble-meta">
                          {msg.edited && <span className="edited-tag">edited</span>}
                          <button
                            className="meta-time"
                            onClick={() => isOwn && setInfoTarget(msg.id)}
                          >
                            {formatTime(msg.created_at)}
                          </button>
                          <Tick delivery={msg.delivery_info} isOwn={isOwn} />
                        </div>
                      )}

                      {isOwn && !msg.deleted && editingId !== msg.id && (
                        <div className="bubble-hover-actions">
                          <button onClick={() => startEdit(msg)}>Edit</button>
                          <button onClick={() => setDeleteTarget(msg.id)}>Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            <div ref={bottomRef} />
          </div>

          {typingUsers.length > 0 && (
            <div className="typing-indicator">
              <span className="mock-dot" />
              <span className="mock-dot" />
              <span className="mock-dot" />
              {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing
            </div>
          )}

          <form className="composer" onSubmit={handleSend}>
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Type a message"
              autoComplete="off"
            />
            <button className="btn btn-primary" type="submit" disabled={!input.trim()}>
              Send
            </button>
          </form>
        </main>
      </div>

      {infoMessage && (
        <div className="modal-backdrop" onClick={() => setInfoTarget(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Message info</h3>
            <div className="info-section">
              <h5>Delivered to ({infoMessage.delivery_info?.delivered_count || 0})</h5>
              {(infoMessage.delivery_info?.delivered_to || []).map((r) => (
                <div key={r.id} className="info-row">
                  <span>{r.user_name}</span>
                  <span className="muted">{formatTime(r.delivered_at)}</span>
                </div>
              ))}
              {(infoMessage.delivery_info?.delivered_to || []).length === 0 && (
                <p className="muted">Not delivered yet</p>
              )}
            </div>
            <div className="info-section">
              <h5>Seen by ({infoMessage.delivery_info?.seen_count || 0})</h5>
              {(infoMessage.delivery_info?.seen_by || []).map((r) => (
                <div key={r.id} className="info-row">
                  <span>{r.user_name}</span>
                  <span className="muted">{formatTime(r.seen_at)}</span>
                </div>
              ))}
              {(infoMessage.delivery_info?.seen_by || []).length === 0 && (
                <p className="muted">No one has seen this yet</p>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setInfoTarget(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete this message?"
        description="This can't be undone. Everyone in the chat will see that it was deleted."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={logoutConfirmOpen}
        title="Log out of Nudge?"
        description="You'll be disconnected from the chat."
        confirmLabel="Logout"
        danger
        onConfirm={handleLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </div>
  );
}
