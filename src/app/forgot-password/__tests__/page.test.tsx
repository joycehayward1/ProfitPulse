/**
 * Tests for the Forgot Password page.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ForgotPasswordPage from "../page";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (props: any) => <img {...props} />,
}));

// Mock InsForge client
const mockSendReset = jest.fn();
jest.mock("@/lib/insforge", () => ({
  getInsForgeClient: () => ({
    auth: {
      sendResetPasswordEmail: mockSendReset,
    },
  }),
}));

// Mock Toast — provide a no-op showToast for the provider
const mockShowToast = jest.fn();
jest.mock("@/components/ui", () => {
  const actual = jest.requireActual("@/components/ui");
  return {
    ...actual,
    useToast: () => ({ showToast: mockShowToast }),
  };
});

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the forgot password form", () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByText("Reset your password")).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
  });

  it("shows validation error for empty email", async () => {
    render(<ForgotPasswordPage />);

    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Email is required").length).toBeGreaterThan(0);
    });
  });

  it("shows validation error for invalid email", async () => {
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "not-valid" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument();
    });
  });

  it("calls InsForge sendResetPasswordEmail on valid submission", async () => {
    mockSendReset.mockResolvedValue({ data: {}, error: null });

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@business.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(mockSendReset).toHaveBeenCalledWith({ email: "test@business.com" });
    });
  });

  it("shows 'Check your email' state after successful send", async () => {
    mockSendReset.mockResolvedValue({ data: {}, error: null });

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@business.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument();
      expect(screen.getByText(/test@business.com/)).toBeInTheDocument();
    });
  });

  it("shows toast on successful send", async () => {
    mockSendReset.mockResolvedValue({ data: {}, error: null });

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@business.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith("success", "Reset link sent! Check your email.");
    });
  });

  it("allows trying again from the success state", async () => {
    mockSendReset.mockResolvedValue({ data: {}, error: null });

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@business.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(screen.getByText("Reset your password")).toBeInTheDocument();
  });

  it("shows error on InsForge failure", async () => {
    mockSendReset.mockResolvedValue({
      data: null,
      error: { message: "User not found" },
    });

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@business.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText("User not found")).toBeInTheDocument();
    });
  });

  it("has a link to log in", () => {
    render(<ForgotPasswordPage />);
    const link = screen.getByRole("link", { name: /log in/i });
    expect(link).toHaveAttribute("href", "/login");
  });
});
