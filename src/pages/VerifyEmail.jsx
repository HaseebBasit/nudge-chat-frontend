import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import AuthLayout from "./AuthLayout.jsx";
import OtpInput from "../components/OtpInput.jsx";
import api, { apiErrorMessage } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { pushToast } = useToast();
  const email = location.state?.email || "";

  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(30);

  useEffect(() => {
    if (!email) {
      navigate("/signup");
    }
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
      const { data } = await api.post("/auth/verify-email", { email, otp });
      login(data.token, data.user);
      pushToast("Email verified", "success");
      navigate("/dashboard");
    } catch (error) {
      pushToast(apiErrorMessage(error), "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    try {
      await api.post("/auth/resend-otp", { email, purpose: "verify" });
      pushToast("New OTP sent", "success");
      setCooldown(30);
    } catch (error) {
      pushToast(apiErrorMessage(error), "error");
    }
  }

  return (
    <AuthLayout
      eyebrow={email ? `Sent to ${email}` : undefined}
      title="Verify your email"
      subtitle="Enter the 6-digit code we just emailed you."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <OtpInput value={otp} onChange={setOtp} />

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? "Verifying…" : "Verify email"}
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
        Wrong email? <Link to="/signup">Go back</Link>
      </p>
    </AuthLayout>
  );
}
