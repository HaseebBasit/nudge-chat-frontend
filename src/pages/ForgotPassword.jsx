import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout.jsx";
import api, { apiErrorMessage } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { pushToast } = useToast();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email });
      pushToast("If that email exists, an OTP is on its way", "success");
      navigate("/reset-password", { state: { email } });
    } catch (error) {
      pushToast(apiErrorMessage(error), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a 6-digit code to confirm it's you.">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field-label">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send code"}
        </button>
      </form>

      <p className="auth-footnote">
        Remembered it? <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
