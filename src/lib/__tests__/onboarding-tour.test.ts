const mockUpsert = jest.fn();
let remoteRow: Record<string, unknown> | null = null;
let remoteError: unknown = null;

jest.mock("../insforge", () => ({
  getInsForgeClient: () => ({
    database: {
      from: () => {
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: () => Promise.resolve({ data: remoteRow, error: remoteError }),
          upsert: (...a: unknown[]) => Promise.resolve(mockUpsert(...a)),
        };
        return chain;
      },
    },
  }),
}));

import {
  TOUR_STEPS,
  loadTourState,
  mergeTourStates,
  readLocalTourState,
  saveTourState,
  tourStorageKey,
} from "../onboarding-tour";

beforeEach(() => {
  window.localStorage.clear();
  mockUpsert.mockReset().mockReturnValue({ error: null });
  remoteRow = null;
  remoteError = null;
});

describe("tour steps", () => {
  it("cover data entry, dashboard, Health Score, what-if scenarios and the glossary", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(ids).toEqual(["welcome", "health-score", "metrics", "data", "scenarios", "help", "finish"]);
    for (const step of TOUR_STEPS.filter((s) => s.targets.some((t) => t.startsWith("nav-")))) {
      expect(step.targets).toContain("nav-mobile-menu");
    }
  });

  it("only link to pages that exist", () => {
    const hrefs = TOUR_STEPS.flatMap((s) => (s.action ? [s.action.href] : []));
    expect(hrefs).toEqual(["/data", "/scenarios", "/glossary", "/assessment"]);
  });
});

describe("readLocalTourState", () => {
  it("defaults to not started", () => {
    expect(readLocalTourState("u1").status).toBe("not_started");
  });

  it("ignores corrupt or out-of-range values", () => {
    window.localStorage.setItem(tourStorageKey("u1"), "{not json");
    expect(readLocalTourState("u1").status).toBe("not_started");

    window.localStorage.setItem(tourStorageKey("u1"), JSON.stringify({ status: "in_progress", step: 99 }));
    expect(readLocalTourState("u1").step).toBe(TOUR_STEPS.length - 1);
  });

  it("is per user", async () => {
    await saveTourState("u1", "completed", 6);
    expect(readLocalTourState("u1").status).toBe("completed");
    expect(readLocalTourState("u2").status).toBe("not_started");
  });
});

describe("mergeTourStates", () => {
  const at = (status: "in_progress" | "dismissed" | "completed", iso: string) => ({ status, step: 1, updatedAt: iso });

  it("keeps a completed tour completed", () => {
    expect(mergeTourStates(at("completed", "2026-01-01"), at("in_progress", "2026-02-01")).status).toBe("completed");
    expect(mergeTourStates(at("in_progress", "2026-02-01"), at("completed", "2026-01-01")).status).toBe("completed");
  });

  it("otherwise prefers the most recent", () => {
    expect(mergeTourStates(at("in_progress", "2026-01-01"), at("dismissed", "2026-02-01")).status).toBe("dismissed");
  });
});

describe("saveTourState / loadTourState", () => {
  it("saves to the browser and to onboarding_progress", async () => {
    await saveTourState("u1", "completed", 6);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", tour_status: "completed", tour_step: 6 }),
      { onConflict: "user_id" }
    );
    expect(mockUpsert.mock.calls[0][0].tour_completed_at).toEqual(expect.any(String));
  });

  it("still works in the browser when the table is missing", async () => {
    mockUpsert.mockImplementation(() => {
      throw new Error("relation onboarding_progress does not exist");
    });
    remoteError = { message: "relation onboarding_progress does not exist" };
    await saveTourState("u1", "dismissed", 3);
    expect(await loadTourState("u1")).toMatchObject({ status: "dismissed", step: 3 });
  });

  it("picks up a tour finished on another device", async () => {
    await saveTourState("u1", "in_progress", 2);
    remoteRow = { tour_status: "completed", tour_step: 6, updated_at: "2020-01-01T00:00:00Z" };
    expect((await loadTourState("u1")).status).toBe("completed");
    expect(readLocalTourState("u1").status).toBe("completed");
  });
});
