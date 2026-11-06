import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { TutorialsUrlSettings } from "../TutorialsUrlSettings";
import { describeAction } from "../admin-utils";
import { resetTutorialsSettingsForTests, useTutorialsUrl } from "@/lib/tutorials-settings";

const COMMUNITY =
  "https://community.fusion4business.net/courses/products/cf34560e-fbf3-4779-878f-e747bf2ed247";

const mockShowToast = jest.fn();
jest.mock("@/components/ui", () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock("@/lib/insforge", () => ({
  getAccessToken: jest.fn().mockResolvedValue("admin-token"),
  getInsForgeClient: () => {
    throw new Error("not used here");
  },
}));

type View = {
  saved: string | null;
  effectiveUrl: string | null;
  source: "saved" | "hidden" | "env" | "default";
  defaultUrl: string;
  available: boolean;
  error?: string;
};

const defaultView: View = { saved: null, effectiveUrl: COMMUNITY, source: "default", defaultUrl: COMMUNITY, available: true };
let current: View;
const fetchMock = global.fetch as jest.Mock;

function respond(view: View, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(view) });
}

function SidebarProbe() {
  const url = useTutorialsUrl();
  return <span data-testid="sidebar-url">{url ?? "hidden"}</span>;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetTutorialsSettingsForTests();
  current = defaultView;
  fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "PUT") {
      const url = JSON.parse(String(init?.body)).url as string;
      current = {
        ...defaultView,
        saved: url,
        effectiveUrl: url || null,
        source: url ? "saved" : "hidden",
      };
    } else if (method === "DELETE") {
      current = defaultView;
    }
    return respond(current);
  });
});

describe("TutorialsUrlSettings", () => {
  it("shows the current address and where it comes from", async () => {
    render(<TutorialsUrlSettings />);
    const input = await screen.findByLabelText("Tutorials page address");
    expect(input).toHaveValue(COMMUNITY);
    expect(screen.getByText(/built-in default address/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the page" })).toHaveAttribute("href", COMMUNITY);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/tutorials-url",
      expect.objectContaining({ headers: { Authorization: "Bearer admin-token" } })
    );
  });

  it("saves a new address and the sidebar picks it up without a reload", async () => {
    render(
      <>
        <SidebarProbe />
        <TutorialsUrlSettings />
      </>
    );
    const input = await screen.findByLabelText("Tutorials page address");
    await waitFor(() => expect(screen.getByTestId("sidebar-url")).toHaveTextContent(COMMUNITY));

    fireEvent.change(input, { target: { value: "  https://new.example.test/courses  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith("success", "Tutorials link saved."));
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(put?.[0]).toBe("/api/admin/tutorials-url");
    expect(JSON.parse(put?.[1].body)).toEqual({ url: "https://new.example.test/courses" });
    expect(put?.[1].headers).toMatchObject({ Authorization: "Bearer admin-token", "Content-Type": "application/json" });
    expect(screen.getByText(/address saved here/)).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-url")).toHaveTextContent("https://new.example.test/courses");
  });

  it("hides the link when saved empty", async () => {
    render(
      <>
        <SidebarProbe />
        <TutorialsUrlSettings />
      </>
    );
    const input = await screen.findByLabelText("Tutorials page address");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith("success", "Tutorials link hidden."));
    expect(screen.getByTestId("sidebar-url")).toHaveTextContent("hidden");
    expect(screen.getByText(/The link is hidden/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open the page" })).not.toBeInTheDocument();
  });

  it("shows the server's message when an address is refused, and keeps what was typed", async () => {
    render(<TutorialsUrlSettings />);
    const input = await screen.findByLabelText("Tutorials page address");
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: "Enter a full web address starting with https://" }) })
    );
    fireEvent.change(input, { target: { value: "ftp://files.example.test/" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    // The browser lets ftp:// through its own url check; the server is the safeguard.
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith("error", "Enter a full web address starting with https://")
    );
    expect(input).toHaveValue("ftp://files.example.test/");
  });

  it("goes back to the default with 'Use the default', which is only offered once something is saved", async () => {
    current = { ...defaultView, saved: "https://old.example.test/", effectiveUrl: "https://old.example.test/", source: "saved" };
    render(<TutorialsUrlSettings />);
    const reset = await screen.findByRole("button", { name: "Use the default" });
    expect(reset).toBeEnabled();
    expect(screen.getByLabelText("Tutorials page address")).toHaveValue("https://old.example.test/");

    fireEvent.click(reset);
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith("success", "Back to the default Tutorials link."));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true);
    expect(screen.getByLabelText("Tutorials page address")).toHaveValue(COMMUNITY);
    expect(screen.getByRole("button", { name: "Use the default" })).toBeDisabled();
  });

  it("explains when the setting can't be stored yet", async () => {
    current = { ...defaultView, available: false, error: "check that database migration 009 (app_settings) has been applied." };
    render(<TutorialsUrlSettings />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/migration 009/);
  });

  it("says so when the setting can't be loaded", async () => {
    fetchMock.mockImplementationOnce(() => respond(defaultView, 500));
    render(<TutorialsUrlSettings />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't load the current setting/);
    expect(screen.queryByLabelText("Tutorials page address")).not.toBeInTheDocument();
  });

  it("disables Save until the address changes", async () => {
    current = { ...defaultView, saved: "https://old.example.test/", effectiveUrl: "https://old.example.test/", source: "saved" };
    render(<TutorialsUrlSettings />);
    const input = await screen.findByLabelText("Tutorials page address");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    act(() => {
      fireEvent.change(input, { target: { value: "https://other.example.test/" } });
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});

describe("activity log wording", () => {
  const base = { id: "1", admin_email: "a@x.co", target_user_id: null, target_email: null, created_at: "2026-11-06T12:00:00Z" };
  it("describes Tutorials link changes", () => {
    expect(describeAction({ ...base, action: "tutorials_url_update", details: { url: "https://x.test/" } })).toBe(
      "Changed the Tutorials link to https://x.test/"
    );
    expect(describeAction({ ...base, action: "tutorials_url_update", details: { url: null } })).toBe("Hid the Tutorials link");
    expect(describeAction({ ...base, action: "tutorials_url_reset", details: {} })).toBe(
      "Reset the Tutorials link to the default"
    );
  });
});
