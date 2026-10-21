import { Link } from 'react-router-dom';
import StatusBadge, { PriorityTag } from './StatusBadge';

const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function RequestTable({ items, showRequester, showOfficer, empty = 'No requests found.' }) {
  if (!items.length) return <div className="empty">{empty}</div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Issue</th>
            <th>Category</th>
            {showRequester && <th>Requested by</th>}
            {showOfficer && <th>Officer</th>}
            <th>Priority</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r._id}>
              <td><Link to={`/requests/${r._id}`} className="ticket">{r.ticketNo}</Link></td>
              <td>
                <Link to={`/requests/${r._id}`} className="cell-title">{r.title}</Link>
                <small className="muted block">{r.location}</small>
              </td>
              <td>{r.category?.name}</td>
              {showRequester && <td>{r.requester?.name}</td>}
              {showOfficer && <td>{r.assignedTo?.name || <span className="muted">Unassigned</span>}</td>}
              <td><PriorityTag priority={r.priority} /></td>
              <td><StatusBadge status={r.status} /></td>
              <td className="nowrap">{fmt(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
