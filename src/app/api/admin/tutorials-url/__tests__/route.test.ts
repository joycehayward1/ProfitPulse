/** @jest-environment node */
import { NextRequest } from "next/server";

let adminUser: { email: string } | null = { email: "admin@x.co" };
let storedValue: string | null = null;
let readError: unknown = null;
let writeError: unknown = null;
const mockUpsert = jest.fn();
const mockDelete = jest.fn();
const mockLog = jest.fn();

jest.mock("@/lib/admin-auth", () => ({ requireAdmin: async () => adminUser }));
jest.mock("@/lib/admin-log", () => ({ logAdminAction: (...a: unknown[]) => mockLog(...a) }));
jest.mock("@/lib/insforge", () => ({
  getInsForgeAdmin: () => ({
    database: {
      from: (table: string) => {
        expect(table).toBe("app_settings");
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: storedValue === null ? null : { value: storedValue },
                  error: readError,
                }),
            }),
          }),
          upsert: (row: Record<string, unknown>, opts: unknown) => {
            mockUpsert(row, opts);
            return Promise.resolve({ error: writeError });
          },
          delete: () => ({
            eq: (col: string, val: string) => {
              mockDelete(col, val);
              return Promise.resolve({ error: writeError });
            },
          }),
        };
      },
    },
  }),
}));

import { DELETE, GET, PUT } from "../route";

const COMMUNITY =
  "https://community.fusion4business.net/courses/products/cf34560e-fbf3-4779-878f-e747bf2ed247";

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/tutorials-url", {
    method,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("/api/admin/tutorials-url", () => {
  const originalEnv = process.env.NEXT_PUBLIC_TUTORIALS_URL;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    adminUser = { email: "admin@x.co" };
    storedValue = null;
    readError = null;
    writeError = null;
    delete process.env.NEXT_PUBLIC_TUTORIALS_URL;
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_TUTORIALS_URL;
    else process.env.NEXT_PUBLIC_TUTORIALS_URL = originalEnv;
  });

  it("refuses everyone who isn't an admin", async () => {
    adminUser = null;
    for (const res of [
      await GET(req("GET")),
      await PUT(req("PUT", { url: "https://x.test/" })),
      await DELETE(req("DELETE")),
    ]) {
      expect(res.status).toBe(403);
    }
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  describe("GET", () => {
    it("reports the default when nothing is saved", async () => {
      const body = await (await GET(req("GET"))).json();
      expect(body).toMatchObject({
        saved: null,
        effectiveUrl: COMMUNITY,
        source: "default",
        defaultUrl: COMMUNITY,
        available: true,
      });
    });

    it("reports the env fallback when nothing is saved", async () => {
      process.env.NEXT_PUBLIC_TUTORIALS_URL = "https://env.example.test/t";
      const body = await (await GET(req("GET"))).json();
      expect(body).toMatchObject({ saved: null, effectiveUrl: "https://env.example.test/t", source: "env" });
    });

    it("lets the saved address win over the env fallback", async () => {
      process.env.NEXT_PUBLIC_TUTORIALS_URL = "https://env.example.test/t";
      storedValue = "https://saved.example.test/t";
      const body = await (await GET(req("GET"))).json();
      expect(body).toMatchObject({ saved: "https://saved.example.test/t", effectiveUrl: "https://saved.example.test/t", source: "saved" });
    });

    it("reports a hidden link when the saved value is empty", async () => {
      storedValue = "";
      const body = await (await GET(req("GET"))).json();
      expect(body).toMatchObject({ saved: "", effectiveUrl: null, source: "hidden" });
    });

    it("says the setting is unavailable (rather than failing) when the table can't be read", async () => {
      readError = { message: "relation does not exist" };
      const res = await GET(req("GET"));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.available).toBe(false);
      expect(body.error).toMatch(/migration 009/);
      expect(body.effectiveUrl).toBe(COMMUNITY);
    });
  });

  describe("PUT", () => {
    it("saves a valid address, records who changed it and logs it", async () => {
      const res = await PUT(req("PUT", { url: "  https://new.example.test/courses  " }));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledTimes(1);
      const [row, opts] = mockUpsert.mock.calls[0];
      expect(row).toMatchObject({ key: "tutorials_url", value: "https://new.example.test/courses", updated_by: "admin@x.co" });
      expect(opts).toEqual({ onConflict: "key" });
      expect(body).toMatchObject({ saved: "https://new.example.test/courses", effectiveUrl: "https://new.example.test/courses", source: "saved" });
      expect(mockLog).toHaveBeenCalledWith(
        { email: "admin@x.co" },
        "tutorials_url_update",
        {},
        { url: "https://new.example.test/courses" }
      );
    });

    it("saves an empty value to hide the link", async () => {
      const res = await PUT(req("PUT", { url: "" }));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(mockUpsert.mock.calls[0][0]).toMatchObject({ value: "" });
      expect(body).toMatchObject({ saved: "", effectiveUrl: null, source: "hidden" });
      expect(mockLog.mock.calls[0][3]).toEqual({ url: null });
    });

    it.each([["community.example.test"], ["javascript:alert(1)"], ["/tutorials"], ["https://u:p@x.test/"], [42]])(
      "rejects %p without saving",
      async (bad) => {
        const res = await PUT(req("PUT", { url: bad }));
        expect(res.status).toBe(400);
        expect(mockUpsert).not.toHaveBeenCalled();
        expect(mockLog).not.toHaveBeenCalled();
      }
    );

    it("rejects a missing url and invalid JSON", async () => {
      expect((await PUT(req("PUT", {}))).status).toBe(400);
      expect((await PUT(req("PUT", "not json"))).status).toBe(400);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("reports a failed save and doesn't log it", async () => {
      writeError = { message: "relation does not exist" };
      const res = await PUT(req("PUT", { url: "https://new.example.test/" }));
      expect(res.status).toBe(500);
      expect((await res.json()).error).toMatch(/migration 009/);
      expect(mockLog).not.toHaveBeenCalled();
    });
  });

  describe("DELETE", () => {
    it("removes the saved value so the default applies again", async () => {
      storedValue = "https://saved.example.test/t";
      const res = await DELETE(req("DELETE"));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(mockDelete).toHaveBeenCalledWith("key", "tutorials_url");
      expect(body).toMatchObject({ saved: null, effectiveUrl: COMMUNITY, source: "default" });
      expect(mockLog).toHaveBeenCalledWith({ email: "admin@x.co" }, "tutorials_url_reset", {});
    });

    it("reports a failed reset", async () => {
      writeError = { message: "nope" };
      expect((await DELETE(req("DELETE"))).status).toBe(500);
      expect(mockLog).not.toHaveBeenCalled();
    });
  });
});
