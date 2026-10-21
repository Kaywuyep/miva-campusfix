import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRequestUpdates } from '../context/SocketContext';
import StatusBadge, { PriorityTag, STATUS_LABELS } from '../components/StatusBadge';
import { FeedbackForm, FeedbackSummary } from '../components/Feedback';
import JobActions from '../components/JobActions';

const STEPS = ['pending', 'assigned', 'in_progress', 'completed'];
const when = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Tracking page: progress bar, details, evidence, timeline and role-specific actions
export default function RequestDetail() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [req, setReq] = useState(null);
  const [error, setError] = useState('');
  const [officers, setOfficers] = useState([]);
  const [officerId, setOfficerId] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get(`/requests/${id}`).then((r) => setReq(r.data.data)).catch((e) => setError(errorMessage(e)));
  }, [id]);

  useEffect(load, [load]);
  useRequestUpdates(useCallback((evt) => evt.id === id && load(), [id, load]));

  useEffect(() => {
    if (role === 'admin') api.get('/users/officers').then((r) => setOfficers(r.data.data));
  }, [role]);

  const act = async (fn, success) => {
    setBusy(true);
    try {
      await fn();
      toast(success);
      setComment('');
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (status) =>
    act(() => api.patch(`/requests/${id}/status`, { status, comment }), `Marked as ${STATUS_LABELS[status].toLowerCase()}`);

  const assign = () => {
    if (!officerId) return toast('Choose an officer first', 'error');
    return act(() => api.patch(`/requests/${id}/assign`, { officerId, note: comment }), 'Officer assigned');
  };

  const sendFeedback = (feedback) =>
    act(() => api.post(`/requests/${id}/feedback`, feedback), 'Thank you — your feedback has been sent');

  const remove = async () => {
    if (!window.confirm('Delete this request permanently?')) return;
    await act(() => api.delete(`/requests/${id}`), 'Request deleted');
    navigate('/requests');
  };

  if (error) return <div className="card card-pad"><div className="alert alert-error">{error}</div><Link to="/requests">← Back to requests</Link></div>;
  if (!req) return <div className="page-loading">Loading request…</div>;

  const isOwner = req.requester._id === user._id;
  const isAssignee = req.assignedTo?._id === user._id;
  const closed = ['completed', 'cancelled'].includes(req.status);
  const stepIndex = STEPS.indexOf(req.status);

  return (
    <>
      <Link to="/requests" className="back">← Back</Link>
      <div className="page-head">
        <div>
          <span className="ticket big">{req.ticketNo}</span>
          <h1>{req.title}</h1>
          <p className="muted">{req.category?.name} · {req.location}</p>
        </div>
        <div className="head-badges"><PriorityTag priority={req.priority} /><StatusBadge status={req.status} /></div>
      </div>

      {req.status !== 'cancelled' && (
        <ol className="progress" aria-label="Request progress">
          {STEPS.map((s, i) => (
            <li key={s} className={i < stepIndex || req.status === 'completed' ? 'done' : i === stepIndex ? 'current' : ''}>
              <span className="dot">{i < stepIndex || req.status === 'completed' ? '✓' : i + 1}</span>
              {STATUS_LABELS[s]}
            </li>
          ))}
        </ol>
      )}

      <div className="detail-grid">
        <div className="stack">
          <section className="card card-pad">
            <h2>Description</h2>
            <p className="prewrap">{req.description}</p>
            {req.attachments?.length > 0 && (
              <>
                <h3>Evidence</h3>
                <div className="thumbs">
                  {req.attachments.map((a) => (
                    <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="thumb">
                      {a.mimetype?.startsWith('image/') ? <img src={a.url} alt={a.filename} /> : <span>PDF</span>}
                      <small>{a.filename}</small>
                    </a>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="card card-pad">
            <h2>Activity timeline</h2>
            <ul className="timeline">
              {req.timeline.map((t) => (
                <li key={t._id}>
                  <div className="tl-dot" />
                  <div>
                    <strong>{t.fromStatus ? `${STATUS_LABELS[t.fromStatus]} → ` : ''}{STATUS_LABELS[t.toStatus]}</strong>
                    {t.comment && <p>{t.comment}</p>}
                    <small className="muted">{t.changedBy?.name} · {when(t.createdAt)}</small>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="stack">
          <section className="card card-pad">
            <h2>Details</h2>
            <dl className="meta">
              <dt>Requested by</dt><dd>{req.requester.name}<small>{req.requester.department}</small></dd>
              <dt>Submitted</dt><dd>{when(req.createdAt)}</dd>
              <dt>Assigned officer</dt><dd>{req.assignedTo ? <>{req.assignedTo.name}<small>{req.assignedTo.phone || req.assignedTo.email}</small></> : <span className="muted">Not yet assigned</span>}</dd>
              {req.completedAt && (<><dt>Completed</dt><dd>{when(req.completedAt)}</dd></>)}
            </dl>
          </section>

          {req.status === 'completed' && isOwner && !req.feedback && <FeedbackForm onSubmit={sendFeedback} busy={busy} />}
          {req.feedback && <FeedbackSummary feedback={req.feedback} mine={isOwner} />}

          {/* ----- Actions depend on role ----- */}
          {role === 'officer' && isAssignee && (
            <section className="card card-pad action-card">
              <h2>Update progress</h2>
              <p className="muted next-step">
                {['pending', 'assigned'].includes(req.status) && 'This job is assigned to you. Press Start job when you begin — the requester will see it is in progress.'}
                {req.status === 'in_progress' && 'You are working on this job. Mark it completed when you finish; add a short note for the requester.'}
                {req.status === 'completed' && (req.feedback ? 'Job completed and rated by the requester.' : 'Job completed. The requester has been asked to rate the repair.')}
                {req.status === 'cancelled' && 'This request was cancelled.'}
              </p>
              <JobActions job={req} onDone={load} />
            </section>
          )}

          {role === 'admin' && (
            <section className="card card-pad action-card">
              <h2>Manage request</h2>
              {!closed && (
                <>
                  <label className="field">
                    <span>{req.assignedTo ? 'Re-assign to' : 'Assign to officer'}</span>
                    <select value={officerId} onChange={(e) => setOfficerId(e.target.value)}>
                      <option value="">Select maintenance officer…</option>
                      {officers.map((o) => <option key={o._id} value={o._id}>{o.name} — {o.department} ({o.openJobs} open)</option>)}
                    </select>
                  </label>
                  <textarea rows={2} placeholder="Instruction / note (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
                  <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={assign}>Assign</button>
                </>
              )}
              <div className="field">
                <span>Override status</span>
                <select value="" onChange={(e) => e.target.value && setStatus(e.target.value)}>
                  <option value="">Change status…</option>
                  {Object.entries(STATUS_LABELS).filter(([k]) => k !== req.status).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-danger-ghost btn-block" disabled={busy} onClick={remove}>Delete request</button>
            </section>
          )}

          {role === 'user' && isOwner && req.status === 'pending' && (
            <section className="card card-pad action-card">
              <h2>Changed your mind?</h2>
              <p className="muted">You can cancel while the request is still pending.</p>
              <button type="button" className="btn btn-danger-ghost btn-block" disabled={busy} onClick={() => setStatus('cancelled')}>Cancel request</button>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
