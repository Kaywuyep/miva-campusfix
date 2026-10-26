import { useState } from 'react';

const LABELS = ['Very poor', 'Poor', 'Okay', 'Good', 'Excellent'];
const when = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

// Client-side rules, mirrored by the API
export function validateFeedback({ rating, resolved, comment }) {
  const errors = {};
  if (!rating) errors.rating = 'Choose a rating from 1 to 5 stars';
  if (resolved === null) errors.resolved = 'Tell us whether the problem was fixed';
  if (comment.length > 500) errors.comment = 'Keep your comment to 500 characters or fewer';
  return errors;
}

// Read-only stars, e.g. ★★★★☆
export function Stars({ rating, size = '' }) {
  return (
    <span className={`stars ${size}`} role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= rating ? 'on' : ''}>★</span>)}
    </span>
  );
}

// Shown to the requester once their request is completed
export function FeedbackForm({ onSubmit, busy, embedded = false }) {
  const [form, setForm] = useState({ rating: 0, resolved: null, comment: '' });
  const [hover, setHover] = useState(0);
  const [errors, setErrors] = useState({});

  const set = (patch) => {
    setForm({ ...form, ...patch });
    setErrors({ ...errors, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) });
  };

  const submit = (e) => {
    e.preventDefault();
    const found = validateFeedback(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    onSubmit({ ...form, comment: form.comment.trim() });
  };

  const shown = hover || form.rating;
  return (
    <form className={embedded ? 'feedback' : 'card card-pad action-card feedback'} onSubmit={submit} noValidate>
      {!embedded && (
        <>
          <h2>How did we do?</h2>
          <p className="muted">Your request is complete. Rating the repair helps the Works department improve.</p>
        </>
      )}

      <fieldset className="field">
        <legend>Was the problem fixed?</legend>
        <div className="choice" role="radiogroup" aria-label="Was the problem fixed?">
          <button type="button" role="radio" aria-checked={form.resolved === true}
            className={`choice-btn ${form.resolved === true ? 'yes' : ''}`} onClick={() => set({ resolved: true })}>
            ✓ Yes, it's fixed
          </button>
          <button type="button" role="radio" aria-checked={form.resolved === false}
            className={`choice-btn ${form.resolved === false ? 'no' : ''}`} onClick={() => set({ resolved: false })}>
            ✕ No, still a problem
          </button>
        </div>
        {errors.resolved && <em className="field-error">{errors.resolved}</em>}
      </fieldset>

      <fieldset className="field">
        <legend>Rate the service</legend>
        <div className="star-input" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={form.rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
              className={n <= shown ? 'on' : ''} onMouseEnter={() => setHover(n)} onClick={() => set({ rating: n })}>
              ★
            </button>
          ))}
          <span className="star-label">{shown ? LABELS[shown - 1] : 'Choose 1–5 stars'}</span>
        </div>
        {errors.rating && <em className="field-error">{errors.rating}</em>}
      </fieldset>

      <label className="field">
        <span>Comment (optional)</span>
        <textarea rows={3} maxLength={500} value={form.comment} placeholder="Anything we should know?"
          onChange={(e) => set({ comment: e.target.value })} aria-invalid={!!errors.comment} />
        <small className="muted counter">{form.comment.length}/500</small>
        {errors.comment && <em className="field-error">{errors.comment}</em>}
      </label>

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  );
}

// What everyone who can see the request sees after it has been rated
export function FeedbackSummary({ feedback, mine }) {
  return (
    <section className={`card card-pad feedback-summary ${feedback.resolved ? '' : 'not-fixed'}`}>
      <h2>{mine ? 'Your feedback' : 'Requester feedback'}</h2>
      <div className="feedback-row">
        <Stars rating={feedback.rating} size="lg" />
        <strong>{feedback.rating}/5 · {LABELS[feedback.rating - 1]}</strong>
      </div>
      <span className={`badge ${feedback.resolved ? 'badge-completed' : 'badge-not-fixed'}`}>
        {feedback.resolved ? 'Problem fixed' : 'Not fixed — needs follow-up'}
      </span>
      {feedback.comment && <p className="feedback-comment">“{feedback.comment}”</p>}
      <small className="muted">Rated on {when(feedback.submittedAt)}</small>
    </section>
  );
}
