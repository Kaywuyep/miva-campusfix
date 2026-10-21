import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import JobActions from '../components/JobActions';

const patch = vi.fn(() => Promise.resolve({ data: {} }));
vi.mock('../api', () => ({ default: { patch: (...a) => patch(...a) }, errorMessage: (e) => e.message }));
vi.mock('../context/ToastContext', () => ({ useToast: () => vi.fn() }));

const job = (status) => ({ _id: 'r1', ticketNo: 'REQ-2026-00009', title: 'Leaking pipe', location: 'Hostel B', status });

describe('Officer job actions', () => {
  beforeEach(() => patch.mockClear());

  test('an assigned job offers Start job and Mark completed', () => {
    render(<JobActions job={job('assigned')} />);
    expect(screen.getByRole('button', { name: /start job/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark completed/i })).toBeInTheDocument();
  });

  test('Start job moves the job to in progress', async () => {
    const onDone = vi.fn();
    render(<JobActions job={job('assigned')} onDone={onDone} />);
    await userEvent.click(screen.getByRole('button', { name: /start job/i }));
    expect(patch).toHaveBeenCalledWith('/requests/r1/status', { status: 'in_progress', comment: undefined });
    expect(onDone).toHaveBeenCalled();
  });

  test('Mark completed asks for a note for the requester, then completes the job', async () => {
    const onDone = vi.fn();
    render(<JobActions job={job('in_progress')} onDone={onDone} />);
    expect(screen.queryByRole('button', { name: /start job/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /mark completed/i }));
    const dialog = screen.getByRole('dialog', { name: /complete REQ-2026-00009/i });
    await userEvent.type(screen.getByLabelText(/what did you do/i), ' Joint replaced and tested ');
    await userEvent.click(screen.getAllByRole('button', { name: /^mark completed$/i }).at(-1));
    expect(patch).toHaveBeenCalledWith('/requests/r1/status', { status: 'completed', comment: 'Joint replaced and tested' });
    expect(onDone).toHaveBeenCalled();
    expect(dialog).not.toBeInTheDocument();
  });

  test('a completed job has no actions', () => {
    const { container } = render(<JobActions job={job('completed')} />);
    expect(container).toBeEmptyDOMElement();
  });
});
