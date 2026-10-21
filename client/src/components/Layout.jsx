import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import Logo from "./Logo";

const NAV = {
  user: [
    ["/dashboard", "Dashboard"],
    ["/requests/new", "New request"],
    ["/requests", "My requests"],
  ],
  officer: [
    ["/dashboard", "Dashboard"],
    ["/requests", "Assigned jobs"],
  ],
  admin: [
    ["/dashboard", "Dashboard"],
    ["/requests", "All requests"],
    ["/requests/new", "Log a request"],
    ["/admin/users", "Users"],
    ["/admin/categories", "Categories"],
    ["/admin/reports", "Reports & audit"],
  ],
};

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    api
      .get("/notifications")
      .then((r) => setData({ items: r.data.data, unread: r.data.unread }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("notifications:changed", load);
    const close = (e) =>
      ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => {
      window.removeEventListener("notifications:changed", load);
      document.removeEventListener("mousedown", close);
    };
  }, [load]);

  const openItem = async (n) => {
    if (!n.read) await api.patch(`/notifications/${n._id}/read`);
    setOpen(false);
    load();
    if (n.request) navigate(`/requests/${n.request}`);
  };

  const readAll = async () => {
    await api.patch("/notifications/read-all");
    load();
  };

  return (
    <div className="bell" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label="Notifications"
        onClick={() => setOpen(!open)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {data.unread > 0 && <span className="bell-count">{data.unread}</span>}
      </button>
      {open && (
        <div className="bell-menu">
          <div className="bell-head">
            <strong>Notifications</strong>
            {data.unread > 0 && (
              <button type="button" className="link-btn" onClick={readAll}>
                Mark all read
              </button>
            )}
          </div>
          {data.items.length === 0 && (
            <p className="muted pad">You are all caught up.</p>
          )}
          {data.items.map((n) => (
            <button
              type="button"
              key={n._id}
              className={`bell-item ${n.read ? "" : "unread"}`}
              onClick={() => openItem(n)}
            >
              <span>{n.message}</span>
              <small>{timeAgo(n.createdAt)}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <Link to="/dashboard" className="brand brand-sidebar" aria-label="codespireFix dashboard">
          <Logo variant="full" size={150} />
        </Link>
        <nav onClick={() => setMenuOpen(false)}>
          {NAV[user.role.name].map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="role-pill">{user.role.label}</span>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn menu-toggle"
            aria-label="Menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ≡
          </button>
          <div className="topbar-right">
            <NotificationBell />
            <div className="who">
              <span className="avatar">
                {user.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={doLogout}
            >
              Log out
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
