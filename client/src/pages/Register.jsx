import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../api";
import AuthShell from "../components/AuthShell";

export function validateRegister(f) {
  const errors = {};
  if (!f.name.trim()) errors.name = "Full name is required";
  if (!/^\S+@\S+\.\S+$/.test(f.email))
    errors.email = "Enter a valid email address";
  if (f.password.length < 8) errors.password = "Use at least 8 characters";
  else if (!/\d/.test(f.password))
    errors.password = "Include at least one number";
  if (f.confirm !== f.password) errors.confirm = "Passwords do not match";
  return errors;
}

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    department: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const change = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name])
      setErrors({ ...errors, [e.target.name]: undefined });
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validateRegister(form);
    setErrors(v);
    setServerError("");
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const { confirm, ...payload } = form;
      await register(payload);
      toast("Account created — welcome to codespireFix!");
      navigate("/dashboard");
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (name, label, type = "text", extra = {}) => (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={form[name]}
        onChange={change}
        aria-invalid={!!errors[name]}
        {...extra}
      />
      {errors[name] && <em className="field-error">{errors[name]}</em>}
    </label>
  );

  return (
    <AuthShell
      title="Create your account"
      subtitle="For students and staff. Officers are added by the administrator."
    >
      {serverError && (
        <div className="alert alert-error" role="alert">
          {serverError}
        </div>
      )}
      <form onSubmit={submit} noValidate>
        {field("name", "Full name", "text", { autoComplete: "name" })}
        {field("email", "Email address", "email", { autoComplete: "email" })}
        <div className="row-2">
          {field("department", "Department / Faculty")}
          {field("phone", "Phone number", "tel")}
        </div>
        <div className="row-2">
          {field("password", "Password", "password", {
            autoComplete: "new-password",
          })}
          {field("confirm", "Confirm password", "password", {
            autoComplete: "new-password",
          })}
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={busy}
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="auth-switch">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
