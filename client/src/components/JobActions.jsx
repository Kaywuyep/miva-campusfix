import { useCallback, useState } from 'react';
import api, { errorMessage } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';

// The officer's next step for a job, right where the job is listed:
// pending/assigned → "Start job", assigned/in progress → "Mark completed" (with a note for the requester)
export default function JobActions({ job, onDone, compact = false }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [note, setNote] = useState('');
  const close = useCallback(() => setCompleting(false), []);

  const update = async (status, comment) => {
    setBusy(true);
    try {
      await api.patch(`/requests/${job._id}/status`, { status, comment });
      toast(status === 'in_progress'
        ? `${job.ticketNo} started — the requester can see it is in progress`
        : `${job.ticketNo} completed — the requester has been asked to rate the repair`);
      setCompleting(false);
      setNote('');
      onDone?.();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const canStart = ['pending', 'assigned'].includes(job.status);
  const canComplete = ['assigned', 'in_progress'].includes(job.status);
  if (!canStart && !canComplete) return compact ? <span className="muted">—</span> : null;

  return (
    <div className={`job-actions ${compact ? 'compact' : ''}`}>
      {canStart && (
        <button type="button" className={`btn btn-primary ${compact ? 'btn-sm' : ''}`} disabled={busy} onClick={() => update('in_progress')}>
          ▶ Start job
        </button>
      )}
      {canComplete && (
        <button type="button" className={`btn btn-success ${compact ? 'btn-sm' : ''}`} disabled={busy} onClick={() => setCompleting(true)}>
          ✓ Mark completed
        </button>
      )}

      {completing && (
        <Modal title={`Complete ${job.ticketNo}`} onClose={close}>
          <form
            className="complete-form"
            onSubmit={(e) => {
              e.preventDefault();
              update('completed', note.trim());
            }}
          >
            <p className="muted"><strong>{job.title}</strong> · {job.location}</p>
            <label className="field">
              <span>What did you do? (shown to the requester)</span>
              <textarea rows={4} maxLength={500} autoFocus value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Replaced the faulty socket and tested the circuit" />
            </label>
            <p className="muted small-print">The requester is notified straight away and asked to rate the repair.</p>
            <div className="report-actions">
              <button type="button" className="btn btn-ghost" onClick={close}>Cancel</button>
              <button type="submit" className="btn btn-success" disabled={busy}>{busy ? 'Saving…' : 'Mark completed'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
