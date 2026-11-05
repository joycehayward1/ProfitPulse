import React from "react";
import { act } from "react";
import { TextDecoder, TextEncoder } from "util";
import { hydrateRoot } from "react-dom/client";
import { screen, waitFor } from "@testing-library/react";
import DashboardPage from "../page";
import { freezeDate } from "@/lib/test-fixtures/clock";

jest.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// react-dom/server needs these, and jsdom doesn't provide them.
Object.assign(global, { TextEncoder, TextDecoder });

afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = "";
});

function greetingHtml(at: Date): string {
  freezeDate(at);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { renderToString } = require("react-dom/server") as typeof import("react-dom/server");
  const html = renderToString(<DashboardPage />);
  jest.useRealTimers();
  return html;
}

describe("dashboard greeting", () => {
  it("renders the same HTML on the server whatever the time, so it can't mismatch the browser", () => {
    const morning = greetingHtml(new Date(2026, 10, 5, 8, 0));
    const evening = greetingHtml(new Date(2027, 0, 9, 21, 0));
    expect(morning).toBe(evening);
    expect(morning).toContain("Welcome back");
    expect(morning).not.toMatch(/Good (morning|afternoon|evening)/);
  });

  it("hydrates without a mismatch and then shows the visitor's own time and date", async () => {
    const container = document.createElement("div");
    container.innerHTML = greetingHtml(new Date(2026, 10, 5, 8, 0));
    document.body.appendChild(container);

    freezeDate(new Date(2026, 10, 5, 21, 30));
    const recoverable = jest.fn();
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      hydrateRoot(container, <DashboardPage />, { onRecoverableError: recoverable });
    });

    await waitFor(() => expect(screen.getByText(/Good evening,/)).toBeInTheDocument());
    expect(screen.getByTestId("greeting-date")).toHaveTextContent("Thursday, November 5, 2026");
    expect(recoverable).not.toHaveBeenCalled();
    const mismatch = consoleError.mock.calls.some((args) => /hydrat|did not match/i.test(String(args[0])));
    expect(mismatch).toBe(false);
    consoleError.mockRestore();
  });
});
