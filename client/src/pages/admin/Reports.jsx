import { useCallback, useEffect, useState } from "react";
import api, { errorMessage } from "../../api";
import { useToast } from "../../context/ToastContext";
import Logo from "../../components/Logo";
import Modal from "../../components/Modal";
import Pagination from "../../components/Pagination";
import RequestTable from "../../components/RequestTable";
import { STATUS_LABELS } from "../../components/StatusBadge";

const PRIORITIES = ["low", "medium", "high", "urgent"];

const when = (d) =>
  new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const day = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// YYYY-MM-DD in the local timezone (what <input type="date"> uses)
const iso = (d) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
  return local.toISOString().slice(0, 10);
};

// Quick period choices; each returns a { from, to } date range
const PERIODS = {
  all: { label: "All time", range: () => ({ from: "", to: "" }) },
  today: {
    label: "Today",
    range: () => ({ from: iso(new Date()), to: iso(new Date()) }),
  },
  week: {
    label: "Last 7 days",
    range: () => ({
      from: iso(new Date(Date.now() - 6 * 864e5)),
      to: iso(new Date()),
    }),
  },
  month: {
    label: "Last 30 days",
    range: () => ({
      from: iso(new Date(Date.now() - 29 * 864e5)),
      to: iso(new Date()),
    }),
  },
  thisMonth: {
    label: "This month",
    range: () => {
      const now = new Date();
      return {
        from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: iso(now),
      };
    },
  },
  custom: { label: "Custom range", range: null },
};

const EMPTY = {
  period: "all",
  from: "",
  to: "",
  status: "",
  category: "",
  priority: "",
  assignedTo: "",
};

// Only send the filters that are actually set
const paramsFor = (f) =>
  Object.fromEntries(Object.entries(f).filter(([k, v]) => v && k !== "period"));

export default function Reports() {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [report, setReport] = useState(null); // { filters, summary, rows } once generated
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [audit, setAudit] = useState({ data: [], pagination: null });
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get("/categories").then((r) => setCategories(r.data.data));
    api.get("/users/officers").then((r) => setOfficers(r.data.data));
  }, []);

  useEffect(() => {
    api
      .get("/reports/audit", { params: { page } })
      .then((r) => setAudit(r.data));
  }, [page]);

  const change = (e) => {
    const { name, value } = e.target;
    if (name === "period") {
      const range = PERIODS[value].range;
      setForm({ ...form, period: value, ...(range ? range() : {}) });
    } else if (name === "from" || name === "to") {
      setForm({ ...form, [name]: value, period: "custom" });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  // Fetch the numbers and the matching requests, then show them in the report modal
  const generate = async (e) => {
    e.preventDefault();
    if (form.from && form.to && form.from > form.to) {
      toast("The start date must be before the end date", "error");
      return;
    }
    const filters = { ...form };
    const params = paramsFor(filters);
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        api.get("/reports/summary", { params }),
        api.get("/requests", { params: { ...params, limit: 100 } }),
      ]);
      setReport({ filters, summary: s.data.data, rows: r.data });
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const closeReport = useCallback(() => setReport(null), []);

  const exportCsv = async () => {
    try {
      const res = await api.get("/reports/export", {
        params: paramsFor(report.filters),
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `codespireFix-report-${iso(new Date())}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Report downloaded");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports &amp; audit trail</h1>
          <p className="muted">
            Choose what to include, then generate the report to view, download
            or print it.
          </p>
        </div>
      </div>

      <form className="card card-pad report-form" onSubmit={generate}>
        <h2>Generate a report</h2>
        <div className="form-grid cols-3">
          <label className="field">
            <span>Report period</span>
            <select name="period" value={form.period} onChange={change}>
              {Object.entries(PERIODS).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>From</span>
            <input
              type="date"
              name="from"
              value={form.from}
              max={form.to || undefined}
              onChange={change}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              type="date"
              name="to"
              value={form.to}
              min={form.from || undefined}
              onChange={change}
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" value={form.status} onChange={change}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Category</span>
            <select name="category" value={form.category} onChange={change}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Priority</span>
            <select name="priority" value={form.priority} onChange={change}>
              <option value="">Any priority</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Maintenance officer</span>
            <select name="assignedTo" value={form.assignedTo} onChange={change}>
              <option value="">All officers</option>
              {officers.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="report-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setForm(EMPTY)}
          >
            Reset
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Generating…" : "Generate report"}
          </button>
        </div>
      </form>

      <section className="card">
        <div className="card-head">
          <h2>Activity log</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.map((a) => (
                <tr key={a._id}>
                  <td className="nowrap">{when(a.createdAt)}</td>
                  <td>{a.actor?.name || "—"}</td>
                  <td>
                    <code className="action">{a.action}</code>
                  </td>
                  <td>{a.details}</td>
                  <td className="muted">{a.ip || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination pagination={audit.pagination} onChange={setPage} />
      </section>

      {report && (
        <Modal
          title="Maintenance report"
          wide
          onClose={closeReport}
          actions={
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={exportCsv}
              >
                ↓ Download CSV
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => window.print()}
              >
                Print / save as PDF
              </button>
            </>
          }
        >
          <ReportView
            report={report}
            categories={categories}
            officers={officers}
          />
        </Modal>
      )}
    </>
  );
}

// The report document itself: shown in the modal and used as the printed page
function ReportView({ report, categories, officers }) {
  const { filters, summary, rows } = report;
  const maxCat = Math.max(1, ...summary.byCategory.map((c) => c.count));
  const resolved = summary.total
    ? Math.round((summary.byStatus.completed / summary.total) * 100)
    : 0;

  // Plain-language description of what this report covers
  const periodText =
    filters.from || filters.to
      ? `${filters.from ? day(filters.from) : "the beginning"} – ${
          filters.to ? day(filters.to) : "today"
        }`
      : "All time";
  const criteria = [
    filters.status && `Status: ${STATUS_LABELS[filters.status]}`,
    filters.category &&
      `Category: ${categories.find((c) => c._id === filters.category)?.name}`,
    filters.priority && `Priority: ${filters.priority}`,
    filters.assignedTo &&
      `Officer: ${officers.find((o) => o._id === filters.assignedTo)?.name}`,
  ].filter(Boolean);

  return (
    <article className="report">
      <img
        src="/brand/watermark.png"
        alt=""
        className="print-watermark print-only"
      />
      <div className="report-head">
        <div className="report-title">
          <Logo variant="mark" tone="light" size={52} />
          <div>
            <h2>codespireFix maintenance report</h2>
            <p className="muted">
              <strong>Period:</strong> {periodText}
              {criteria.length > 0 && <> · {criteria.join(" · ")}</>}
              <br />
              Generated {when(summary.generatedAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="stat-value">{summary.total}</span>
          <span className="stat-label">Total requests</span>
        </div>
        <div className="stat stat-completed">
          <span className="stat-value">{resolved}%</span>
          <span className="stat-label">Resolution rate</span>
        </div>
        <div className="stat stat-in_progress">
          <span className="stat-value">
            {summary.avgResolutionHours ?? "–"}h
          </span>
          <span className="stat-label">Avg. time to fix</span>
        </div>
        <div className="stat stat-pending">
          <span className="stat-value">{summary.byStatus.pending}</span>
          <span className="stat-label">Awaiting assignment</span>
        </div>
      </div>

      <div className="detail-grid even">
        <section className="card card-pad">
          <h2>Requests by category</h2>
          <div className="bars">
            {summary.byCategory.map((c) => (
              <div key={c.name} className="bar-row">
                <span>{c.name}</span>
                <div className="bar">
                  <div style={{ width: `${(c.count / maxCat) * 100}%` }} />
                </div>
                <strong>{c.count}</strong>
              </div>
            ))}
          </div>
          <h3>By status</h3>
          <div className="status-strip">
            {Object.entries(summary.byStatus).map(([k, v]) => (
              <div key={k} className={`badge badge-${k}`}>
                {STATUS_LABELS[k]}: {v}
              </div>
            ))}
          </div>
          <h3>By priority</h3>
          <div className="status-strip">
            {Object.entries(summary.byPriority).map(([k, v]) => (
              <div key={k} className="badge badge-neutral">
                {k}: {v}
              </div>
            ))}
          </div>
        </section>
        <section className="card card-pad">
          <h2>Officer workload</h2>
          <table className="table compact">
            <thead>
              <tr>
                <th>Officer</th>
                <th>Open jobs</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {summary.byOfficer.map((o) => (
                <tr key={o.name}>
                  <td>{o.name}</td>
                  <td>{o.open}</td>
                  <td>{o.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="card report-list">
        <div className="card-head">
          <h2>Requests in this report</h2>
          {rows.pagination && rows.pagination.total > rows.data.length && (
            <small className="muted">
              Showing {rows.data.length} of {rows.pagination.total} — download
              the CSV for the full list
            </small>
          )}
        </div>
        <RequestTable
          items={rows.data}
          showRequester
          showOfficer
          empty="No requests match this report."
        />
      </section>

      <footer className="report-footer print-only">
        <Logo variant="full" tone="light" size={90} />
        <span>
          codespireFix · University Works &amp; Services Department · Report
          generated {when(summary.generatedAt)}
        </span>
      </footer>
    </article>
  );
}
