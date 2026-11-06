const mockSend = jest.fn();
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

import { sendEmail } from "../resend";

const email = { from: "from@example.test", to: "to@example.test", subject: "s", html: "h" };

beforeAll(() => {
  process.env.RESEND_API_KEY = "test-resend-key";
});

beforeEach(() => mockSend.mockReset());

describe("sendEmail", () => {
  it("returns the email id on success", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null, headers: null });
    await expect(sendEmail(email)).resolves.toBe("email-1");
  });

  it("throws when Resend returns an error instead of throwing", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { name: "rate_limit_exceeded", message: "Too many requests" },
      headers: null,
    });
    await expect(sendEmail(email)).rejects.toThrow("rate_limit_exceeded");
  });
});
