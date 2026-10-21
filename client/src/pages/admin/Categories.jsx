import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../../api';
import { useToast } from '../../context/ToastContext';

export default function Categories() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', description: '' });

  const load = useCallback(() => {
    api.get('/categories').then((r) => setItems(r.data.data));
  }, []);
  useEffect(load, [load]);

  const run = async (fn, msg) => {
    try {
      await fn();
      toast(msg);
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const add = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast('Category name is required', 'error');
    return run(async () => {
      await api.post('/categories', form);
      setForm({ name: '', description: '' });
    }, 'Category added');
  };

  return (
    <>
      <div className="page-head"><div><h1>Request categories</h1><p className="muted">The types of problem users can report.</p></div></div>
      <section className="card card-pad">
        <form className="inline-form" onSubmit={add} noValidate>
          <input placeholder="Category name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button type="submit" className="btn btn-primary">Add category</button>
        </form>
      </section>
      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Description</th><th>Status</th><th /></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c._id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.description}</td>
                  <td><span className={`badge ${c.isActive ? 'badge-completed' : 'badge-cancelled'}`}>{c.isActive ? 'Active' : 'Hidden'}</span></td>
                  <td className="right nowrap">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(() => api.put(`/categories/${c._id}`, { isActive: !c.isActive }), 'Category updated')}>
                      {c.isActive ? 'Hide' : 'Show'}
                    </button>
                    <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => run(() => api.delete(`/categories/${c._id}`), 'Category deleted')}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
