import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Pagination from '../../components/Pagination';

const ROLE_LABEL = { user: 'Student/Staff', officer: 'Maintenance Officer', admin: 'Administrator' };
const EMPTY = { name: '', email: '', password: '', role: 'officer', department: '', phone: '' };

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], pagination: null });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    api.get('/users', { params: { page, limit: 8, q: q || undefined, role: roleFilter || undefined } })
      .then((r) => setResult(r.data));
  }, [page, q, roleFilter]);

  useEffect(load, [load]);

  const update = async (u, changes, msg) => {
    try {
      await api.put(`/users/${u._id}`, changes);
      toast(msg);
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.name}?`)) return;
    try {
      await api.delete(`/users/${u._id}`);
      toast('User deleted');
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const create = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name || !form.email || form.password.length < 8) {
      setFormError('Name, email and a password of at least 8 characters are required');
      return;
    }
    try {
      await api.post('/users', form);
      toast(`${ROLE_LABEL[form.role]} account created`);
      setForm(EMPTY);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const ch = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>User management</h1>
          <p className="muted">Create officer accounts, change roles and deactivate users.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close' : '+ Add user'}</button>
      </div>

      {showForm && (
        <section className="card card-pad">
          <h2>New user</h2>
          {formError && <div className="alert alert-error">{formError}</div>}
          <form className="form-grid cols-3" onSubmit={create} noValidate>
            <label className="field"><span>Full name</span><input name="name" value={form.name} onChange={ch} /></label>
            <label className="field"><span>Email</span><input name="email" type="email" value={form.email} onChange={ch} /></label>
            <label className="field"><span>Temporary password</span><input name="password" type="password" value={form.password} onChange={ch} /></label>
            <label className="field"><span>Role</span>
              <select name="role" value={form.role} onChange={ch}>
                {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field"><span>Department / Unit</span><input name="department" value={form.department} onChange={ch} /></label>
            <label className="field"><span>Phone</span><input name="phone" value={form.phone} onChange={ch} /></label>
            <div className="span-3 form-actions"><button type="submit" className="btn btn-primary">Create account</button></div>
          </form>
        </section>
      )}

      <section className="card">
        <div className="filters">
          <input className="search" type="search" placeholder="Search name, email or department…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
            <option value="">All roles</option>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Status</th><th /></tr></thead>
            <tbody>
              {result.data.map((u) => (
                <tr key={u._id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td>{u.department || '—'}</td>
                  <td>
                    <select className="inline-select" value={u.role.name} disabled={u._id === me._id}
                      onChange={(e) => update(u, { role: e.target.value }, 'Role updated')}>
                      {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td><span className={`badge ${u.isActive ? 'badge-completed' : 'badge-cancelled'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="nowrap right">
                    {u._id !== me._id && (
                      <>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => update(u, { isActive: !u.isActive }, u.isActive ? 'User deactivated' : 'User activated')}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => remove(u)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination pagination={result.pagination} onChange={setPage} />
      </section>
    </>
  );
}
