import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout.jsx";
import api, { apiErrorMessage } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data.token, data.user);
      pushToast(`Welcome back, ${data.user.name.split(" ")[0]}`, "success");
      navigate("/dashboard");
    } catch (error) {
      if (error?.response?.data?.needsVerification) {
        pushToast("Please verify your email first", "info");
        navigate("/verify-email", { state: { email: error.response.data.email } });
        return;
      }
      pushToast(apiErrorMessage(error), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Log in to your account" subtitle="Pick up right where the conversation left off.">
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

        <label className="field-label">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        <div className="field-row-end">
          <Link className="link-muted" to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="auth-footnote">
        Don't have an account? <Link to="/signup">Create one</Link>
      </p>
    </AuthLayout>
  );
}
