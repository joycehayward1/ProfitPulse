/**
 * Tests for InsForge client utilities.
 */

// Provide a global fetch mock since InsForge SDK requires it
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("getInsForgeClient", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("throws when NEXT_PUBLIC_INSFORGE_URL is not set", () => {
    delete process.env.NEXT_PUBLIC_INSFORGE_URL;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getInsForgeClient } = require("../insforge");
    expect(() => getInsForgeClient()).toThrow("NEXT_PUBLIC_INSFORGE_URL is not set");
  });

  it("creates a client when URL is set", () => {
    process.env.NEXT_PUBLIC_INSFORGE_URL = "https://test.insforge.app";

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getInsForgeClient } = require("../insforge");
    const client = getInsForgeClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(client.database).toBeDefined();
    expect(client.ai).toBeDefined();
  });

  it("returns the same singleton instance on multiple calls", () => {
    process.env.NEXT_PUBLIC_INSFORGE_URL = "https://test.insforge.app";

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getInsForgeClient } = require("../insforge");
    const client1 = getInsForgeClient();
    const client2 = getInsForgeClient();
    expect(client1).toBe(client2);
  });
});

describe("getInsForgeAdmin", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("throws when NEXT_PUBLIC_INSFORGE_URL is not set", () => {
    delete process.env.NEXT_PUBLIC_INSFORGE_URL;
    process.env.INSFORGE_API_KEY = "test-key";

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getInsForgeAdmin } = require("../insforge");
    expect(() => getInsForgeAdmin()).toThrow("NEXT_PUBLIC_INSFORGE_URL is not set");
  });

  it("throws when INSFORGE_API_KEY is not set", () => {
    process.env.NEXT_PUBLIC_INSFORGE_URL = "https://test.insforge.app";
    delete process.env.INSFORGE_API_KEY;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getInsForgeAdmin } = require("../insforge");
    expect(() => getInsForgeAdmin()).toThrow("INSFORGE_API_KEY is not set");
  });

  it("creates admin client when both env vars are set", () => {
    process.env.NEXT_PUBLIC_INSFORGE_URL = "https://test.insforge.app";
    process.env.INSFORGE_API_KEY = "test-admin-key";

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getInsForgeAdmin } = require("../insforge");
    const client = getInsForgeAdmin();
    expect(client).toBeDefined();
    expect(client.database).toBeDefined();
  });
});
