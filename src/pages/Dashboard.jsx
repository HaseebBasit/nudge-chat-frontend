import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";

function initials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleLogout() {
    logout();
    setConfirmOpen(false);
    pushToast("Logged out", "info");
    navigate("/login");
  }

  return (
    <div className="screen-center">
      <div className="dash-card">
        <div className="dash-avatar">{initials(user?.name)}</div>
        <h2 className="dash-name">{user?.name}</h2>
        <p className="dash-email">{user?.email}</p>

        <span className={`status-pill ${user?.verified ? "status-verified" : "status-pending"}`}>
          <span className="status-dot" />
          {user?.verified ? "Verified" : "Not verified"}
        </span>

        <div className="dash-actions">
          <button className="btn btn-primary btn-block" onClick={() => navigate("/chat")}>
            Continue to chat
          </button>
          <button className="btn btn-outline btn-block" onClick={() => setConfirmOpen(true)}>
            Logout
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Log out of Nudge?"
        description="You'll need to log in again to open the chat."
        confirmLabel="Logout"
        danger
        onConfirm={handleLogout}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
