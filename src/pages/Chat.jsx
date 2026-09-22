import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./index.css";

const BACKEND_URL =
  import.meta.env.VITE_API_URL ||
  "https://nudge-chat-backend.onrender.com";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  BACKEND_URL;

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

export default function Chat({ user, onLogout }) {
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const notificationAudioRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [infoTarget, setInfoTarget] = useState(null);

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const messageListRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      onLogout();
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);

      socket.emit("join_chat", {
        token,
      });
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setConnected(false);
    });

    socket.on("chat_history", (history) => {
      setMessages(history || []);
      setLoading(false);

      setTimeout(() => {
        scrollToBottom();
      }, 100);
    });

    socket.on("message_received", (newMessage) => {
      setMessages((prev) => {
        const exists = prev.some((msg) => msg.id === newMessage.id);

        if (exists) {
          return prev;
        }

        return [...prev, newMessage];
      });

      setTimeout(() => {
        scrollToBottom();
      }, 50);

      if (newMessage.sender_id !== user?.id) {
        try {
          notificationAudioRef.current?.play();
        } catch {
          // Ignore browser autoplay restrictions
        }
      }
    });

    socket.on("message_updated", (updatedMessage) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === updatedMessage.id ? updatedMessage : msg
        )
      );
    });

    socket.on("message_deleted", ({ id, deleted_by }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === id
            ? {
                ...msg,
                deleted: true,
                deleted_by,
                message: "",
              }
            : msg
        )
      );
    });

    socket.on("message_delivery_updated", (updatedMessage) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === updatedMessage.id
            ? {
                ...msg,
                delivery_info: updatedMessage.delivery_info,
              }
            : msg
        )
      );
    });

    socket.on("online_users", (users) => {
      setOnlineUsers(users || []);
    });

    socket.on("user_typing", ({ userId, userName }) => {
      if (userId === user?.id) return;

      setTypingUsers((prev) => {
        const exists = prev.some((u) => u.userId === userId);

        if (exists) return prev;

        return [...prev, { userId, userName }];
      });
    });

    socket.on("user_stop_typing", ({ userId }) => {
      setTypingUsers((prev) =>
        prev.filter((u) => u.userId !== userId)
      );
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, onLogout]);

  function scrollToBottom() {
    if (!messageListRef.current) return;

    messageListRef.current.scrollTop =
      messageListRef.current.scrollHeight;
  }

  function sendMessage(e) {
    e.preventDefault();

    const trimmed = message.trim();

    if (!trimmed) return;
    if (!socketRef.current) return;

    socketRef.current.emit("send_message", {
      message: trimmed,
    });

    setMessage("");

    socketRef.current.emit("stop_typing");

    setTimeout(() => {
      scrollToBottom();
    }, 50);
  }

  function handleTyping(e) {
    const value = e.target.value;

    setMessage(value);

    if (!socketRef.current) return;

    socketRef.current.emit("typing");

    clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("stop_typing");
    }, 800);
  }

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

    const trimmed = editText.trim();

    if (!trimmed) return;

    socketRef.current?.emit("edit_message", {
      id: editingId,
      message: trimmed,
    });

    cancelEdit();
  }

  function confirmDelete() {
    if (!deleteTarget) return;

    socketRef.current?.emit("delete_message", {
      id: deleteTarget,
    });

    setDeleteTarget(null);
  }

  function formatTime(date) {
    if (!date) return "";

    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getInitials(name) {
    if (!name) return "?";

    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  const currentUserId = user?.id;

  return (
    <div className="chat-shell">
      <audio
        ref={notificationAudioRef}
        preload="auto"
        src="/notification.mp3"
      />

      <header className="chat-topbar">
        <div className="chat-brand">
          <div className="brand-mark">N</div>

          <div>
            <div className="brand-name">Nudge</div>
            <div className="brand-status">
              {connected ? "Connected" : "Connecting..."}
            </div>
          </div>
        </div>

        <div className="chat-user">
          <div className="user-avatar">
            {getInitials(user?.name)}
          </div>

          <div className="user-details">
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
          </div>

          <button className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="chat-body">
        <aside className="chat-sidebar">
          <div className="sidebar-header">
            <h3>People</h3>
            <span>{onlineUsers.length} online</span>
          </div>

          <div className="online-list">
            {onlineUsers.length === 0 ? (
              <div className="empty-online">
                No one is online
              </div>
            ) : (
              onlineUsers.map((onlineUser) => (
                <div
                  className="online-user"
                  key={onlineUser.id || onlineUser.userId}
                >
                  <div className="online-avatar">
                    {getInitials(
                      onlineUser.name || onlineUser.userName
                    )}
                    <span className="online-dot" />
                  </div>

                  <div className="online-user-info">
                    <strong>
                      {onlineUser.name ||
                        onlineUser.userName ||
                        "User"}
                    </strong>
                    <span>Online</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        <main className="chat-main">
          <div className="chat-main-header">
            <div>
              <h2>General Chat</h2>
              <p>Talk with everyone on Nudge</p>
            </div>

            <div
              className={`connection-status ${
                connected ? "connected" : ""
              }`}
            >
              <span />
              {connected ? "Live" : "Offline"}
            </div>
          </div>

          <div className="message-list" ref={messageListRef}>
            {loading ? (
              <div className="chat-loading">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="chat-empty">
                <div className="empty-icon">💬</div>
                <h3>No messages yet</h3>
                <p>Start the conversation.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn =
                  msg.sender_id === currentUserId ||
                  msg.user_id === currentUserId;

                return (
                  <div
                    key={msg.id}
                    className={`message-row ${
                      isOwn ? "own" : "other"
                    }`}
                  >
                    {!isOwn && (
                      <div className="message-avatar">
                        {getInitials(msg.sender_name)}
                      </div>
                    )}

                    <div className="message-bubble">
                      {!isOwn && (
                        <div className="bubble-sender">
                          {msg.sender_name}
                        </div>
                      )}

                      {msg.deleted ? (
                        <div className="bubble-deleted">
                          Deleted by {msg.deleted_by}
                        </div>
                      ) : editingId === msg.id ? (
                        <form
                          className="edit-form"
                          onSubmit={saveEdit}
                        >
                          <input
                            value={editText}
                            onChange={(e) =>
                              setEditText(e.target.value)
                            }
                            autoFocus
                          />

                          <div className="edit-actions">
                            <button
                              type="button"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>

                            <button type="submit">
                              Save
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="bubble-text">
                          {msg.message}
                        </div>
                      )}

                      {!msg.deleted && (
                        <div className="bubble-meta">
                          {msg.edited && (
                            <span className="edited-tag">
                              edited
                            </span>
                          )}

                          <button
                            className="meta-time"
                            onClick={() =>
                              isOwn && setInfoTarget(msg.id)
                            }
                          >
                            {formatTime(msg.created_at)}
                          </button>

                          {isOwn && (
                            <button
                              className="message-info-btn"
                              onClick={() =>
                                setInfoTarget(msg.id)
                              }
                              title="Message info"
                              type="button"
                            >
                              ⓘ
                            </button>
                          )}

                          <Tick
                            delivery={msg.delivery_info}
                            isOwn={isOwn}
                          />
                        </div>
                      )}

                      {isOwn &&
                        !msg.deleted &&
                        editingId !== msg.id && (
                          <div className="bubble-hover-actions">
                            <button
                              type="button"
                              onClick={() => startEdit(msg)}
                              title="Edit message"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget(msg.id)
                              }
                              title="Delete message"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })
            )}

            {typingUsers.length > 0 && (
              <div className="typing-indicator">
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>

                <span>
                  {typingUsers.length === 1
                    ? `${typingUsers[0].userName} is typing...`
                    : "Someone is typing..."}
                </span>
              </div>
            )}
          </div>

          <form className="composer" onSubmit={sendMessage}>
            <input
              type="text"
              value={message}
              onChange={handleTyping}
              placeholder="Write a message..."
              disabled={!connected}
            />

            <button
              className="send-btn"
              type="submit"
              disabled={!connected || !message.trim()}
            >
              Send
            </button>
          </form>
        </main>
      </div>

      {deleteTarget && (
        <div
          className="modal-backdrop"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-icon danger">!</div>

            <h3>Delete message?</h3>

            <p>
              This message will be removed for everyone.
            </p>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>

              <button
                className="btn btn-danger"
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {infoTarget && (
        <div
          className="modal-backdrop"
          onClick={() => setInfoTarget(null)}
        >
          <div
            className="modal info-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-icon">ⓘ</div>

            <h3>Message info</h3>

            {(() => {
              const infoMessage = messages.find(
                (msg) => msg.id === infoTarget
              );

              const delivery = infoMessage?.delivery_info;

              return (
                <div className="message-info">
                  <div className="info-row">
                    <span>Sent</span>
                    <strong>
                      {infoMessage
                        ? formatTime(infoMessage.created_at)
                        : "-"}
                    </strong>
                  </div>

                  <div className="info-row">
                    <span>Delivered</span>
                    <strong>
                      {delivery?.delivered_count > 0
                        ? "✓ Delivered"
                        : "Not delivered"}
                    </strong>
                  </div>

                  <div className="info-row">
                    <span>Seen</span>
                    <strong>
                      {delivery?.seen_count > 0
                        ? "✓✓ Seen"
                        : "Not seen"}
                    </strong>
                  </div>
                </div>
              );
            })()}

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setInfoTarget(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}