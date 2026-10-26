import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import RatePrompt from '../components/RatePrompt';

const job = (n) => ({
  _id: `r${n}`, ticketNo: `REQ-2026-0000${n}`, title: n === 1 ? 'Leaking pipe' : 'Broken chair', location: 'Hostel B',
  status: 'completed', completedAt: '2026-10-21T10:00:00Z', assignedTo: { name: 'Chinedu Okafor' },
});
let waiting = [];
const get = vi.fn((url) => {
  if (url === '/requests') return Promise.resolve({ data: { data: waiting } });
  return Promise.resolve({ data: { data: { timeline: [{ toStatus: 'in_progress' }, { toStatus: 'completed', comment: 'Joint replaced and tested' }] } } });
});
const post = vi.fn(() => Promise.resolve({ data: {} }));
vi.mock('../api', () => ({ default: { get: (...a) => get(...a), post: (...a) => post(...a) }, errorMessage: (e) => e.message }));
vi.mock('../context/ToastContext', () => ({ useToast: () => vi.fn() }));
vi.mock('../context/SocketContext', () => ({ useRequestUpdates: () => {} }));

const renderPrompt = () => render(<MemoryRouter><RatePrompt /></MemoryRouter>);

describe('Rating prompt for the requester', () => {
  beforeEach(() => {
    sessionStorage.clear();
    post.mockClear();
  });

  test('pops up after login with the job, who fixed it and their note, then sends the rating', async () => {
    waiting = [job(1)];
    renderPrompt();
    const dialog = await screen.findByRole('dialog', { name: /rate your completed repair/i });
    expect(within(dialog).getByText('Leaking pipe')).toBeInTheDocument();
    expect(within(dialog).getByText('Chinedu Okafor')).toBeInTheDocument();
    expect(await within(dialog).findByText('“Joint replaced and tested”')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('radio', { name: /yes, it's fixed/i }));
    await userEvent.click(within(dialog).getByRole('radio', { name: '5 stars' }));
    await userEvent.type(within(dialog).getByPlaceholderText(/anything we should know/i), 'Great job');
    await userEvent.click(within(dialog).getByRole('button', { name: /send feedback/i }));

    expect(post).toHaveBeenCalledWith('/requests/r1/feedback', { rating: 5, resolved: true, comment: 'Great job' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/rate your completed repair/i)).not.toBeInTheDocument();
  });

  test('"Remind me later" closes the pop-up but the dashboard card keeps asking', async () => {
    waiting = [job(1), job(2)];
    renderPrompt();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('1 of 2 to rate')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: /remind me later/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const card = screen.getByLabelText(/rate your completed repair/i);
    expect(within(card).getByRole('button', { name: /send feedback/i })).toBeInTheDocument();
  });

  test('shows nothing when every completed job has been rated', async () => {
    waiting = [];
    const { container } = renderPrompt();
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });
});
