import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRequestUpdates } from '../context/SocketContext';
import RequestTable from '../components/RequestTable';
import JobActions from '../components/JobActions';
import RatingCell from '../components/RatingCell';
import Pagination from '../components/Pagination';
import { STATUS_LABELS } from '../components/StatusBadge';

const TITLES = { user: 'My requests', officer: 'Assigned jobs', admin: 'All requests' };

// Search + filter + pagination over the requests the current role can see
export default function Requests() {
  const { role } = useAuth();
  const toast = useToast();
  const [filters, setFilters] = useState({ q: '', status: '', category: '', priority: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], pagination: null });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/categories').then((r) => setCategories(r.data.data));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 8, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
    api.get('/requests', { params })
      .then((r) => setResult(r.data))
      .catch((e) => toast(errorMessage(e), 'error'))
      .finally(() => setLoading(false));
  }, [page, filters, toast]);

  useEffect(load, [load]);
  useRequestUpdates(load);

  // Debounce the search box so we don't call the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setFilters((f) => ({ ...f, q: search }));
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const setFilter = (e) => {
    setPage(1);
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const exportCsv = async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const res = await api.get('/reports/export', { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `service-requests-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast('CSV exported');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{TITLES[role]}</h1>
          <p className="muted">{result.pagination ? `${result.pagination.total} request(s)` : ' '}</p>
        </div>
        {role === 'admin' && <button type="button" className="btn btn-ghost" onClick={exportCsv}>↓ Export CSV</button>}
      </div>

      <section className="card">
        <div className="filters">
          <input className="search" type="search" placeholder="Search ticket, title or location…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
          <select name="status" value={filters.status} onChange={setFilter} aria-label="Status">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="category" value={filters.category} onChange={setFilter} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <select name="priority" value={filters.priority} onChange={setFilter} aria-label="Priority">
            <option value="">Any priority</option>
            {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className={loading ? 'loading-fade' : ''}>
          <RequestTable items={result.data} showRequester={role !== 'user'} showOfficer={role === 'admin'}
            actions={role === 'officer' ? (r) => <JobActions job={r} onDone={load} compact />
              : role === 'user' ? (r) => <RatingCell request={r} /> : undefined}
            actionsLabel={role === 'user' ? 'Your rating' : 'Next step'}
            empty="No requests match your search." />
        </div>
        <Pagination pagination={result.pagination} onChange={setPage} />
      </section>
    </>
  );
}
