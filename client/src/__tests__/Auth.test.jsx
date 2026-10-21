import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import Login, { validateLogin } from "../pages/Login";
import { validateRegister } from "../pages/Register";
import ProtectedRoute from "../components/ProtectedRoute";

// Replace the real auth hook with a controllable fake
const authState = { user: null, loading: false, login: vi.fn() };
vi.mock("../context/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("../context/ToastContext", () => ({ useToast: () => vi.fn() }));

describe("Login page", () => {
  test("validates email and password before calling the API", async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(authState.login).not.toHaveBeenCalled();
  });

  test("shows the server error message on failed login", async () => {
    authState.login = vi.fn().mockRejectedValue({
      response: { data: { message: "Invalid email or password" } },
    });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    await userEvent.type(
      screen.getByLabelText(/email/i),
      "student@codespirefix.edu",
    );
    await userEvent.type(screen.getByLabelText(/password/i), "wrong-pass1");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password",
    );
  });

  test("validateLogin and validateRegister rules", () => {
    expect(validateLogin({ email: "bad", password: "x" }).email).toMatch(
      /valid email/,
    );
    const errs = validateRegister({
      name: "",
      email: "a@b.co",
      password: "abcdefgh",
      confirm: "zzz",
    });
    expect(errs.name).toBeDefined();
    expect(errs.password).toMatch(/number/);
    expect(errs.confirm).toMatch(/do not match/);
  });
});

describe("ProtectedRoute (role-based access)", () => {
  const renderAt = (roles) =>
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={roles}>
                <p>secret admin page</p>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<p>login page</p>} />
          <Route path="/dashboard" element={<p>dashboard page</p>} />
        </Routes>
      </MemoryRouter>,
    );

  test("hides the page from a visitor who is not logged in", () => {
    authState.user = null;
    renderAt(["admin"]);
    expect(screen.queryByText("secret admin page")).not.toBeInTheDocument();
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  test("hides an admin page from a student", () => {
    authState.user = { name: "Ada", role: { name: "user" } };
    renderAt(["admin"]);
    expect(screen.queryByText("secret admin page")).not.toBeInTheDocument();
    expect(screen.getByText("dashboard page")).toBeInTheDocument();
  });

  test("shows the page to an admin", () => {
    authState.user = { name: "Grace", role: { name: "admin" } };
    renderAt(["admin"]);
    expect(screen.getByText("secret admin page")).toBeInTheDocument();
  });
});
