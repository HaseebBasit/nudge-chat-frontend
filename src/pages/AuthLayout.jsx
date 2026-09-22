import React from "react";

export default function AuthLayout({ eyebrow, title, subtitle, children }) {
  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <div className="brand-mark">
          <span className="brand-dot" />
          Nudge
        </div>

        <div className="visual-copy">
          <h1>Every message, accounted for.</h1>
          <p>Sent, delivered, seen — in real time, down to who's typing right now.</p>
        </div>

        <div className="mock-chat" aria-hidden="true">
          <div className="mock-bubble mock-bubble-in">
            <span>Are we still on for the demo?</span>
          </div>
          <div className="mock-bubble mock-bubble-out">
            <span>Yes — pushing the build now</span>
            <span className="mock-tick mock-tick-seen">✓✓</span>
          </div>
          <div className="mock-typing">
            <span className="mock-typing-name">Areeba is typing</span>
            <span className="mock-dot" />
            <span className="mock-dot" />
            <span className="mock-dot" />
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-wrap">
          {eyebrow && <div className="form-eyebrow">{eyebrow}</div>}
          <h2 className="form-title">{title}</h2>
          {subtitle && <p className="form-subtitle">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
