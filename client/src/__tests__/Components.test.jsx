import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import RequestTable from '../components/RequestTable';

describe('StatusBadge', () => {
  test.each([
    ['pending', 'Pending'],
    ['in_progress', 'In progress'],
    ['completed', 'Completed'],
  ])('renders %s as "%s" with matching style', (status, label) => {
    render(<StatusBadge status={status} />);
    const el = screen.getByText(label);
    expect(el).toHaveClass(`badge-${status}`);
  });
});

describe('Pagination', () => {
  test('shows the range and disables Prev on the first page', async () => {
    const onChange = vi.fn();
    render(<Pagination pagination={{ page: 1, pages: 3, total: 25, limit: 10 }} onChange={onChange} />);
    expect(screen.getByText('Showing 1–10 of 25')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});

describe('RequestTable', () => {
  const rows = [{
    _id: 'r1', ticketNo: 'REQ-2026-00001', title: 'Fan not working', location: 'LT 2',
    category: { name: 'Electrical' }, priority: 'high', status: 'assigned',
    requester: { name: 'Ada Obi' }, assignedTo: { name: 'Musa Ibrahim' }, createdAt: '2026-10-01T10:00:00Z',
  }];

  test('renders rows with a link to the tracking page', () => {
    render(<MemoryRouter><RequestTable items={rows} showRequester showOfficer /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'REQ-2026-00001' })).toHaveAttribute('href', '/requests/r1');
    expect(screen.getByText('Musa Ibrahim')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
  });

  test('shows the empty message when there are no rows', () => {
    render(<MemoryRouter><RequestTable items={[]} empty="Nothing here" /></MemoryRouter>);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
