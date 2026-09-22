import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import AuthLayout from "./AuthLayout.jsx";
import OtpInput from "../components/OtpInput.jsx";
import api, { apiErrorMessage } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const email = location.state?.email || "";

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(30);

  useEffect(() => {
    if (!email) navigate("/forgot-password");
  }, [email, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (otp.length !== 6) {
      pushToast("Enter the full 6-digit code", "error");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { email, otp, newPassword });
      pushToast("Password updated — please log in", "success");
      navigate("/login");
    } catch (error) {
      pushToast(apiErrorMessage(error), "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    try {
      await api.post("/auth/resend-otp", { email, purpose: "reset" });
      pushToast("New OTP sent", "success");
      setCooldown(30);
    } catch (error) {
      pushToast(apiErrorMessage(error), "error");
    }
  }

  return (
    <AuthLayout
      eyebrow={email ? `Code sent to ${email}` : undefined}
      title="Enter your new password"
      subtitle="Confirm the code and choose a new password."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <OtpInput value={otp} onChange={setOtp} />

        <label className="field-label">
          New password
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </label>

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? "Updating…" : "Update password"}
        </button>

        <button
          type="button"
          className="link-button"
          onClick={handleResend}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </form>

      <p className="auth-footnote">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
