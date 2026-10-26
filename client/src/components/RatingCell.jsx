import { Link } from 'react-router-dom';
import { Stars } from './Feedback';

// Requester's view of a row: rate a completed job, or see the stars they gave
export default function RatingCell({ request }) {
  if (request.status !== 'completed') return <span className="muted">—</span>;
  if (request.feedback) return <Stars rating={request.feedback.rating} />;
  return <Link to={`/requests/${request._id}`} className="btn btn-sm rate-btn">★ Rate</Link>;
}
