import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import Reports from "../pages/admin/Reports";

const summary = {
  total: 3,
  byStatus: { pending: 1, assigned: 0, in_progress: 1, completed: 1, cancelled: 0 },
  byPriority: { low: 1, medium: 1, high: 1, urgent: 0 },
  byCategory: [{ name: "Electrical", count: 3 }],
  byOfficer: [{ name: "Ada Officer", open: 1, completed: 1, avgRating: 4.5 }],
  satisfaction: { rated: 2, avgRating: 4.5, notFixed: 1, byStars: [0, 0, 0, 1, 1] },
  avgResolutionHours: 5,
  generatedAt: "2026-10-21T10:00:00.000Z",
};

// Fake API: answers each endpoint the reports page calls
const get = vi.fn((url) => {
  const data = {
    "/categories": { data: [{ _id: "c1", name: "Electrical" }] },
    "/users/officers": { data: [{ _id: "o1", name: "Ada Officer" }] },
    "/reports/audit": { data: [], pagination: null },
    "/reports/summary": { data: summary },
    "/requests": { data: [], pagination: { total: 0 } },
  }[url];
  return Promise.resolve({ data });
});
vi.mock("../api", () => ({ default: { get: (...a) => get(...a) }, errorMessage: (e) => e.message }));
vi.mock("../context/ToastContext", () => ({ useToast: () => vi.fn() }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <Reports />
    </MemoryRouter>,
  );

describe("Reports page", () => {
  test("generating a report opens it in a modal with download and print options", async () => {
    renderPage();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Status"), "completed");
    await userEvent.click(screen.getByRole("button", { name: /generate report/i }));

    const dialog = await screen.findByRole("dialog", { name: /maintenance report/i });
    expect(get).toHaveBeenCalledWith("/reports/summary", { params: { status: "completed" } });
    expect(within(dialog).getByText(/Status: Completed/)).toBeInTheDocument();
    expect(within(dialog).getByText("Requester satisfaction")).toBeInTheDocument();
    expect(within(dialog).getByText("1 not fixed")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /download csv/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /print/i })).toBeInTheDocument();
  });

  test("the report modal closes with Esc or the close button", async () => {
    renderPage();
    const generate = screen.getByRole("button", { name: /generate report/i });

    await userEvent.click(generate);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(generate);
    await userEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
