/**
 * Tests for the Sign Up page.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SignUpPage from "../page";

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
const mockSignUp = jest.fn();
const mockProfileUpsert = jest.fn().mockResolvedValue({ data: null, error: null });
jest.mock("@/lib/insforge", () => ({
  getInsForgeClient: () => ({
    auth: {
      signUp: mockSignUp,
    },
    database: {
      from: jest.fn(() => ({
        upsert: mockProfileUpsert,
      })),
    },
  }),
}));

describe("SignUpPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the signup form with all fields", () => {
    render(<SignUpPage />);

    expect(screen.getByText("Let's get you some clarity")).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^industry/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get started/i })).toBeInTheDocument();
  });

  it("renders industry dropdown with all options", () => {
    render(<SignUpPage />);

    const select = screen.getByLabelText(/^industry/i);
    expect(select).toBeInTheDocument();

    const options = Array.from(select.querySelectorAll("option"));
    const values = options.map((o) => o.value);

    expect(values).toContain("Professional Services");
    expect(values).toContain("Financial Services & Accounting");
    expect(values).toContain("Healthcare & Wellness");
    expect(values).toContain("Coaching, Consulting & Speaking");
    expect(values).toContain("Construction & Trades");
    expect(values).toContain("Retail & E-Commerce");
    expect(values).toContain("Nonprofit & Faith-Based Organizations");
    expect(values).toContain("Real Estate & Property Services");
    expect(values).toContain("Other");
  });

  it("shows validation errors when submitting empty form", async () => {
    render(<SignUpPage />);

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByText("Email is required")).toBeInTheDocument();
      expect(screen.getByText("Business name is required")).toBeInTheDocument();
      expect(screen.getByText("Please select your industry")).toBeInTheDocument();
      expect(screen.getByText("Password is required")).toBeInTheDocument();
      expect(screen.getByText("Please confirm your password")).toBeInTheDocument();
    });
  });

  it("shows error for invalid email", async () => {
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "invalid" },
    });
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument();
    });
  });

  it("shows error for short password", async () => {
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    });
  });

  it("shows error when passwords don't match", async () => {
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "different123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    });
  });

  it("calls InsForge signUp with correct data on valid submission", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "1" } }, error: null });

    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@business.com" },
    });
    fireEvent.change(screen.getByLabelText(/business name/i), {
      target: { value: "Test Corp" },
    });
    fireEvent.change(screen.getByLabelText(/^industry/i), {
      target: { value: "Professional Services" },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "test@business.com",
        password: "password123",
        name: "Test User",
      });
    });
  });

  it("redirects to email verification when required", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "1" }, requireEmailVerification: true },
      error: null,
    });

    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@business.com" },
    });
    fireEvent.change(screen.getByLabelText(/business name/i), {
      target: { value: "Test Corp" },
    });
    fireEvent.change(screen.getByLabelText(/^industry/i), {
      target: { value: "Professional Services" },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/verify-email?email=test%40business.com");
    });
  });

  it("redirects to dashboard when signup signs the user in", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "1" } }, error: null });

    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@business.com" },
    });
    fireEvent.change(screen.getByLabelText(/business name/i), {
      target: { value: "Test Corp" },
    });
    fireEvent.change(screen.getByLabelText(/^industry/i), {
      target: { value: "Professional Services" },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows API error on signup failure", async () => {
    mockSignUp.mockResolvedValue({
      data: null,
      error: { message: "Email already in use" },
    });

    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@business.com" },
    });
    fireEvent.change(screen.getByLabelText(/business name/i), {
      target: { value: "Test Corp" },
    });
    fireEvent.change(screen.getByLabelText(/^industry/i), {
      target: { value: "Professional Services" },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByText("Email already in use")).toBeInTheDocument();
    });
  });

  it("has a link to the login page", () => {
    render(<SignUpPage />);
    const link = screen.getByRole("link", { name: /log in/i });
    expect(link).toHaveAttribute("href", "/login");
  });
});
