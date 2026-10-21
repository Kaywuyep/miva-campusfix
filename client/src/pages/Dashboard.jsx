import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useRequestUpdates } from '../context/SocketContext';
import RequestTable from '../components/RequestTable';
import JobActions from '../components/JobActions';

const CARDS = {
  user: [['total', 'All my requests'], ['pending', 'Awaiting action'], ['in_progress', 'Being fixed'], ['completed', 'Resolved']],
  officer: [['assigned', 'New jobs'], ['in_progress', 'In progress'], ['completed', 'Completed'], ['total', 'Total assigned']],
  admin: [['total', 'Total requests'], ['pending', 'Unassigned'], ['in_progress', 'In progress'], ['completed', 'Completed']],
};

const COPY = {
  user: ['Report a problem and follow it until it is fixed.', 'Recent requests'],
  officer: ['Start a job when you begin and mark it completed when you finish — the requester is kept informed.', 'Your open jobs'],
  admin: ['Overview of maintenance activity across campus.', 'New requests waiting to be assigned'],
};

export default function Dashboard() {
  const { user, role } = useAuth();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);

  const load = useCallback(() => {
    api.get('/requests/stats').then((r) => setStats(r.data.data));
    const params = { limit: 5 };
    if (role === 'admin') params.status = 'pending';
    if (role === 'officer') params.status = 'assigned,in_progress';
    api.get('/requests', { params }).then((r) => setRecent(r.data.data));
  }, [role]);

  useEffect(load, [load]);
  useRequestUpdates(load); // live refresh when any request changes

  const value = (key) => (key === 'total' ? stats?.total : stats?.byStatus?.[key]) ?? '–';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Good day, {user.name.split(' ')[0]}</h1>
          <p className="muted">{COPY[role][0]}</p>
        </div>
        {role !== 'officer' && <Link to="/requests/new" className="btn btn-primary">+ New request</Link>}
      </div>

      <div className="stats">
        {CARDS[role].map(([key, label]) => (
          <div key={key} className={`stat stat-${key}`}>
            <span className="stat-value">{value(key)}</span>
            <span className="stat-label">{label}</span>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="card-head">
          <h2>{COPY[role][1]}</h2>
          <Link to="/requests" className="link">View all →</Link>
        </div>
        <RequestTable
          items={recent}
          showRequester={role !== 'user'}
          showOfficer={role === 'admin'}
          actions={role === 'officer' ? (r) => <JobActions job={r} onDone={load} compact /> : undefined}
          empty={role === 'user' ? 'You have not submitted any requests yet.' : 'Nothing waiting here — nice work.'}
        />
      </section>
    </>
  );
}
