import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import RequestForm, { validateRequest } from '../components/RequestForm';

const categories = [
  { _id: 'c1', name: 'Electrical' },
  { _id: 'c2', name: 'Plumbing' },
];

describe('RequestForm', () => {
  test('shows validation messages and does not submit an empty form', async () => {
    const onSubmit = vi.fn();
    render(<RequestForm categories={categories} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: /submit request/i }));

    expect(screen.getByText(/at least 5 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/choose a category/i)).toBeInTheDocument();
    expect(screen.getByText(/tell us where/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('lists categories from the API in the dropdown', () => {
    render(<RequestForm categories={categories} onSubmit={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'Electrical' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Plumbing' })).toBeInTheDocument();
  });

  test('submits the form data when valid', async () => {
    const onSubmit = vi.fn();
    render(<RequestForm categories={categories} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/title of the issue/i), 'Leaking pipe in toilet');
    await userEvent.selectOptions(screen.getByLabelText(/category/i), 'c2');
    await userEvent.type(screen.getByLabelText(/location/i), 'Hostel A, Block 3');
    await userEvent.type(screen.getByLabelText(/description/i), 'Water is leaking from the pipe behind the toilet.');
    await userEvent.click(screen.getByRole('button', { name: /submit request/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [form, files] = onSubmit.mock.calls[0];
    expect(form).toMatchObject({ title: 'Leaking pipe in toilet', category: 'c2', location: 'Hostel A, Block 3', priority: 'medium' });
    expect(files).toEqual([]);
  });

  test('validateRequest rejects more than 3 files and oversized files', () => {
    const ok = { title: 'Broken window', category: 'c1', location: 'Room 4', description: 'The window glass is cracked.' };
    expect(validateRequest(ok, [{}, {}, {}, {}]).files).toMatch(/at most 3/);
    expect(validateRequest(ok, [{ size: 6 * 1024 * 1024 }]).files).toMatch(/5 MB/);
    expect(validateRequest(ok, [])).toEqual({});
  });
});
