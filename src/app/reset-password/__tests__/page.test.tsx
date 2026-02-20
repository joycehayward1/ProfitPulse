/**
 * Tests for the Reset Password page.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ResetPasswordPage from "../page";

// Mock next/navigation
const mockPush = jest.fn();
const mockGet = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
}));

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (props: any) => <img {...props} />,
}));

// Mock InsForge client
const mockResetPassword = jest.fn();
jest.mock("@/lib/insforge", () => ({
  getInsForgeClient: () => ({
    auth: {
      resetPassword: mockResetPassword,
    },
  }),
}));

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: token present via query param
    mockGet.mockReturnValue("abc123");
  });

  it("renders the reset password form when token is present via query param", async () => {
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText("Set your new password")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("At least 8 characters")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type your password again")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset password/i })).toBeInTheDocument();
  });

  it("shows invalid link state when no token is present", async () => {
    mockGet.mockReturnValue(null);

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText("Invalid or expired link")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /request new link/i })).toBeInTheDocument();
  });

  it("navigates to forgot-password when clicking Request New Link", async () => {
    mockGet.mockReturnValue(null);

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText("Invalid or expired link")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /request new link/i }));
    expect(mockPush).toHaveBeenCalledWith("/forgot-password");
  });

  it("shows validation error when password is empty", async () => {
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText("Set your new password")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText("Password is required")).toBeInTheDocument();
    });
  });

  it("shows validation error when password is too short", async () => {
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText("Set your new password")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByPlaceholderText("Type your password again"), {
      target: { value: "short" },
    });

    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    });
  });

  it("shows error when passwords don't match", async () => {
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText("Set your new password")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Type your password again"), {
      target: { value: "different123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    });
  });

  it("calls InsForge resetPassword on valid submission", async () => {
    mockResetPassword.mockResolvedValue({ data: { message: "OK" }, error: null });

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText("Set your new password")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "newpassword123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Type your password again"), {
      target: { value: "newpassword123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith({
        newPassword: "newpassword123",
        otp: "abc123",
      });
    });
  });

  it("shows success state after password reset", async () => {
    mockResetPassword.mockResolvedValue({ data: { message: "OK" }, error: null });

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText("Set your new password")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "newpassword123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Type your password again"), {
      target: { value: "newpassword123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText("Password updated!")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /go to login/i })).toBeInTheDocument();
    });
  });

  it("navigates to login from success state", async () => {
    mockResetPassword.mockResolvedValue({ data: { message: "OK" }, error: null });

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText("Set your new password")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "newpassword123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Type your password again"), {
      target: { value: "newpassword123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText("Password updated!")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /go to login/i }));
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("shows error on InsForge failure", async () => {
    mockResetPassword.mockResolvedValue({
      data: null,
      error: { message: "Token expired" },
    });

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText("Set your new password")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "newpassword123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Type your password again"), {
      target: { value: "newpassword123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText("Token expired")).toBeInTheDocument();
    });
  });

  it("has a link to log in from the form", async () => {
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText("Set your new password")).toBeInTheDocument();
    });

    const link = screen.getByRole("link", { name: /log in/i });
    expect(link).toHaveAttribute("href", "/login");
  });
});
