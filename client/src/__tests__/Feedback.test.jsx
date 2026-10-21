import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { FeedbackForm, FeedbackSummary, validateFeedback } from '../components/Feedback';

describe('Requester feedback', () => {
  test('validateFeedback requires a rating and a fixed / not fixed answer', () => {
    expect(validateFeedback({ rating: 0, resolved: null, comment: '' })).toEqual({
      rating: 'Choose a rating from 1 to 5 stars',
      resolved: 'Tell us whether the problem was fixed',
    });
    expect(validateFeedback({ rating: 4, resolved: false, comment: 'x'.repeat(501) }).comment).toMatch(/500/);
    expect(validateFeedback({ rating: 5, resolved: true, comment: '' })).toEqual({});
  });

  test('shows messages and does not submit an incomplete form', async () => {
    const onSubmit = vi.fn();
    render(<FeedbackForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: /send feedback/i }));
    expect(screen.getByText('Choose a rating from 1 to 5 stars')).toBeInTheDocument();
    expect(screen.getByText('Tell us whether the problem was fixed')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('submits the rating, the fixed answer and the comment', async () => {
    const onSubmit = vi.fn();
    render(<FeedbackForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('radio', { name: /yes, it's fixed/i }));
    await userEvent.click(screen.getByRole('radio', { name: '4 stars' }));
    expect(screen.getByText('Good')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/anything we should know/i), '  Quick and tidy  ');
    await userEvent.click(screen.getByRole('button', { name: /send feedback/i }));
    expect(onSubmit).toHaveBeenCalledWith({ rating: 4, resolved: true, comment: 'Quick and tidy' });
  });

  test('summary flags a job the requester says is not fixed', () => {
    render(<FeedbackSummary feedback={{ rating: 2, resolved: false, comment: 'Still leaking', submittedAt: '2026-10-21T10:00:00Z' }} />);
    expect(screen.getByRole('img', { name: '2 out of 5 stars' })).toBeInTheDocument();
    expect(screen.getByText('Not fixed — needs follow-up')).toBeInTheDocument();
    expect(screen.getByText('“Still leaking”')).toBeInTheDocument();
  });
});
