import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { useToast } from '../context/ToastContext';
import RequestForm from '../components/RequestForm';

export default function NewRequest() {
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/categories').then((r) => setCategories(r.data.data));
  }, []);

  // multipart/form-data so the photos travel with the form fields
  const submit = async (form, files) => {
    setBusy(true);
    setError('');
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, v));
      files.forEach((f) => data.append('attachments', f));
      const res = await api.post('/requests', data);
      toast(`Request ${res.data.data.ticketNo} submitted`);
      navigate(`/requests/${res.data.data._id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>New service request</h1>
          <p className="muted">Tell us what needs fixing. You'll be notified as it progresses.</p>
        </div>
      </div>
      <section className="card card-pad narrow">
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <RequestForm categories={categories} onSubmit={submit} busy={busy} />
      </section>
    </>
  );
}
