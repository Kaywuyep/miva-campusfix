import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { useToast } from '../context/ToastContext';
import { useRequestUpdates } from '../context/SocketContext';
import { FeedbackForm } from './Feedback';
import Modal from './Modal';

const day = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

// Show the pop-up once per login: the key changes whenever a new token is issued
const seenKey = () => {
  try {
    return `rate-prompt-seen:${(localStorage.getItem('token') || '').slice(-16)}`;
  } catch {
    return 'rate-prompt-seen';
  }
};
const alreadySeen = () => {
  try {
    return sessionStorage.getItem(seenKey()) === '1';
  } catch {
    return false;
  }
};
const markSeen = () => {
  try {
    sessionStorage.setItem(seenKey(), '1');
  } catch {
    /* storage unavailable: the dashboard card still asks */
  }
};

// The request being rated: what it was, who fixed it and what they said they did
function RateItem({ item, note, position, total, busy, onSubmit }) {
  return (
    <div className="rate-item">
      <div className="rate-item-head">
        <Link to={`/requests/${item._id}`} className="ticket">{item.ticketNo}</Link>
        {total > 1 && <span className="muted">{position} of {total} to rate</span>}
      </div>
      <h3>{item.title}</h3>
      <p className="muted rate-meta">
        {item.location}
        {item.assignedTo && <> · Fixed by <strong>{item.assignedTo.name}</strong></>}
        {item.completedAt && <> on {day(item.completedAt)}</>}
      </p>
      {note && <blockquote className="officer-note">“{note}”</blockquote>}
      <FeedbackForm key={item._id} embedded busy={busy} onSubmit={onSubmit} />
    </div>
  );
}

// Asks the requester to rate completed jobs: a pop-up right after login and a card on the dashboard
export default function RatePrompt() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  // live = a job was just completed while the requester is here, so ask straight away
  const load = useCallback((live = false) => {
    api
      .get('/requests', { params: { status: 'completed', rated: 'false', limit: 20 } })
      .then((r) => {
        setItems(r.data.data);
        if (r.data.data.length && (live || !alreadySeen())) {
          markSeen();
          setOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => load(), [load]);
  useRequestUpdates(useCallback((evt) => evt.status === 'completed' && load(true), [load]));

  // The officer's completion note, from the request's timeline
  const current = items[0];
  useEffect(() => {
    setNote('');
    if (!current) return;
    api
      .get(`/requests/${current._id}`)
      .then((r) => {
        const done = [...r.data.data.timeline].reverse().find((t) => t.toStatus === 'completed');
        setNote(done?.comment || '');
      })
      .catch(() => {});
  }, [current]);

  const close = useCallback(() => setOpen(false), []);

  const submit = async (feedback) => {
    setBusy(true);
    try {
      await api.post(`/requests/${current._id}/feedback`, feedback);
      toast(`Thank you — your rating for ${current.ticketNo} has been sent`);
      const rest = items.slice(1);
      setItems(rest);
      if (!rest.length) setOpen(false);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!current) return null;
  const body = <RateItem item={current} note={note} position={1} total={items.length} busy={busy} onSubmit={submit} />;

  return (
    <>
      <section className="card card-pad rate-card" aria-label="Rate your completed repair">
        <div className="rate-card-head">
          <span className="rate-icon" aria-hidden="true">★</span>
          <div>
            <h2>Your request has been completed — how did we do?</h2>
            <p className="muted">Tell us whether the problem was fixed and rate the service. It takes ten seconds.</p>
          </div>
        </div>
        {!open && body}
      </section>

      {open && (
        <Modal title="Rate your completed repair" onClose={close}>
          {body}
          <button type="button" className="link-btn later" onClick={close}>Remind me later</button>
        </Modal>
      )}
    </>
  );
}
