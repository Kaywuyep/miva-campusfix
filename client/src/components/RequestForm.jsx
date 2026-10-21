import { useState } from 'react';

const MAX_FILES = 3;
const MAX_SIZE = 5 * 1024 * 1024;

export function validateRequest(f, files = []) {
  const errors = {};
  if (f.title.trim().length < 5) errors.title = 'Give the issue a short title (at least 5 characters)';
  if (f.title.length > 120) errors.title = 'Title must be 120 characters or fewer';
  if (!f.category) errors.category = 'Choose a category';
  if (!f.location.trim()) errors.location = 'Tell us where the problem is';
  if (f.description.trim().length < 10) errors.description = 'Describe the problem (at least 10 characters)';
  if (files.length > MAX_FILES) errors.files = `Attach at most ${MAX_FILES} files`;
  else if (files.some((x) => x.size > MAX_SIZE)) errors.files = 'Each file must be 5 MB or smaller';
  return errors;
}

// Presentational form — the page decides what to do on submit
export default function RequestForm({ categories, onSubmit, busy }) {
  const [form, setForm] = useState({ title: '', category: '', location: '', priority: 'medium', description: '' });
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});

  const change = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: undefined });
  };

  const submit = (e) => {
    e.preventDefault();
    const v = validateRequest(form, files);
    setErrors(v);
    if (Object.keys(v).length === 0) onSubmit(form, files);
  };

  return (
    <form onSubmit={submit} noValidate className="form-grid">
      <label className="field span-2">
        <span>Title of the issue *</span>
        <input name="title" value={form.title} onChange={change} placeholder="e.g. Ceiling fan not working" aria-invalid={!!errors.title} />
        {errors.title && <em className="field-error">{errors.title}</em>}
      </label>

      <label className="field">
        <span>Category *</span>
        <select name="category" value={form.category} onChange={change} aria-invalid={!!errors.category}>
          <option value="">Select a category…</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        {errors.category && <em className="field-error">{errors.category}</em>}
      </label>

      <label className="field">
        <span>Priority</span>
        <select name="priority" value={form.priority} onChange={change}>
          <option value="low">Low — can wait</option>
          <option value="medium">Medium</option>
          <option value="high">High — affecting work/study</option>
          <option value="urgent">Urgent — safety risk</option>
        </select>
      </label>

      <label className="field span-2">
        <span>Location *</span>
        <input name="location" value={form.location} onChange={change} placeholder="Building, floor and room — e.g. Hostel B, Room 214" aria-invalid={!!errors.location} />
        {errors.location && <em className="field-error">{errors.location}</em>}
      </label>

      <label className="field span-2">
        <span>Description *</span>
        <textarea name="description" rows={5} value={form.description} onChange={change} placeholder="What is wrong, since when, and anything the officer should know." aria-invalid={!!errors.description} />
        {errors.description && <em className="field-error">{errors.description}</em>}
      </label>

      <label className="field span-2">
        <span>Evidence photos (optional, up to 3 — JPG, PNG or PDF, 5 MB each)</span>
        <input type="file" accept="image/*,application/pdf" multiple onChange={(e) => setFiles(Array.from(e.target.files))} data-testid="file-input" />
        {errors.files && <em className="field-error">{errors.files}</em>}
        {files.length > 0 && (
          <div className="thumbs">
            {files.map((f) => (
              <div key={f.name} className="thumb">
                {f.type.startsWith('image/') && typeof URL.createObjectURL === 'function'
                  ? <img src={URL.createObjectURL(f)} alt={f.name} />
                  : <span>PDF</span>}
                <small>{f.name}</small>
              </div>
            ))}
          </div>
        )}
      </label>

      <div className="span-2 form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</button>
      </div>
    </form>
  );
}
