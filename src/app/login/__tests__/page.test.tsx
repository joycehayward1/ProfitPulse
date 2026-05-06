/**
 * Tests for the Login page.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "../page";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (props: any) => <img {...props} />,
}));

// Mock InsForge client
const mockSignIn = jest.fn();
jest.mock("@/lib/insforge", () => ({
  getInsForgeClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
    },
  }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the login form with email and password fields", () => {
    render(<LoginPage />);

    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("shows validation errors for empty fields", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText("Email is required")).toBeInTheDocument();
      expect(screen.getByText("Password is required")).toBeInTheDocument();
    });
  });

  it("shows error for invalid email", async () => {
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "not-an-email" },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument();
    });
  });

  it("calls InsForge signInWithPassword on valid submission", async () => {
    mockSignIn.mockResolvedValue({
      data: { accessToken: "test-token", user: { id: "1" } },
      error: null,
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@business.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "test@business.com",
        password: "password123",
      });
    });
  });

  it("redirects to /dashboard on successful login", async () => {
    mockSignIn.mockResolvedValue({
      data: { accessToken: "test-token", user: { id: "1" } },
      error: null,
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@business.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error on login failure", async () => {
    mockSignIn.mockResolvedValue({
      data: null,
      error: { message: "Invalid credentials" },
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@business.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "wrongpassword" },
    });

    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Invalid credentials")
      ).toBeInTheDocument();
    });
  });

  it("has a forgot password link", () => {
    render(<LoginPage />);
    const link = screen.getByRole("link", { name: /forgot password/i });
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("has a link to the signup page", () => {
    render(<LoginPage />);
    const link = screen.getByRole("link", { name: /sign up/i });
    expect(link).toHaveAttribute("href", "/signup");
  });
});
