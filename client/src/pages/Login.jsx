import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../api";
import AuthShell from "../components/AuthShell";

export function validateLogin({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = "Email is required";
  else if (!/^\S+@\S+\.\S+$/.test(email))
    errors.email = "Enter a valid email address";
  if (!password) errors.password = "Password is required";
  return errors;
}

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const expired = new URLSearchParams(location.search).get("expired");

  const change = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name])
      setErrors({ ...errors, [e.target.name]: undefined });
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validateLogin(form);
    setErrors(v);
    setServerError("");
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      toast(`Welcome back, ${user.name.split(" ")[0]}`);
      navigate(location.state?.from?.pathname || "/dashboard", {
        replace: true,
      });
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Report and track maintenance issues across campus."
    >
      {expired && (
        <div className="alert alert-info">
          Your session expired. Please sign in again.
        </div>
      )}
      {serverError && (
        <div className="alert alert-error" role="alert">
          {serverError}
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <label className="field">
          <span>Email address</span>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={change}
            autoComplete="email"
            placeholder="you@codespirefix.edu"
            aria-invalid={!!errors.email}
          />
          {errors.email && <em className="field-error">{errors.email}</em>}
        </label>
        <label className="field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={change}
            autoComplete="current-password"
            aria-invalid={!!errors.password}
          />
          {errors.password && (
            <em className="field-error">{errors.password}</em>
          )}
        </label>
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={busy}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="auth-switch">
        New student or staff member?{" "}
        <Link to="/register">Create an account</Link>
      </p>
    </AuthShell>
  );
}
