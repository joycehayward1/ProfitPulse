/**
 * Product tour state for new accounts: steps, and per-user progress.
 *
 * Progress lives in localStorage (instant, works signed-in on this device)
 * and in the onboarding_progress table (migration 008) so it follows the user
 * across devices. The table write is best-effort: before the migration is
 * applied it fails quietly and the browser copy is used.
 */

export type TourStatus = "not_started" | "in_progress" | "dismissed" | "completed";

export interface TourState {
  status: TourStatus;
  step: number;
  updatedAt: string;
}

export interface TourStep {
  id: string;
  /** data-tour targets, first visible one wins (desktop sidebar link, then the mobile menu button). */
  targets: string[];
  title: string;
  body: string;
  /** Extra line shown when the step's target is the mobile menu button. */
  mobileHint?: string;
  action?: { label: string; href: string };
}

export const INTRO_COMPLETE_EVENT = "profitpulse:intro-complete";

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    targets: ["sample-banner"],
    title: "Here's what your dashboard will look like",
    body:
      "Until you add your own numbers, we're showing example data for a made-up business. None of it is yours, and none of it is saved to your account.",
  },
  {
    id: "health-score",
    targets: ["sample-health-score"],
    title: "Your Health Score",
    body:
      "One number from 0 to 100 that sums up how your business is doing. It's based on your cash runway (40%), profit margin (30%) and how quickly you get paid (30%). Click \"How is this scored?\" on your dashboard to see what each range means.",
  },
  {
    id: "metrics",
    targets: ["sample-metrics"],
    title: "Profit, cash flow and runway",
    body:
      "Your key numbers at a glance. The colored dot shows green when you're on track, yellow when something needs a look, and red when it needs attention now.",
  },
  {
    id: "data",
    targets: ["nav-data", "nav-mobile-menu"],
    title: "Add your numbers on the Data page",
    body:
      "Type your numbers in or upload a spreadsheet, and the dashboard, reports and Health Score update from there. QuickBooks sync is coming soon.",
    mobileHint: "On your phone, open the menu to find Data.",
    action: { label: "Open Data", href: "/data" },
  },
  {
    id: "scenarios",
    targets: ["nav-scenarios", "nav-mobile-menu"],
    title: "Try a what-if",
    body:
      "Scenarios lets you test a decision before you make it: your break-even point, a revenue goal, whether you can afford to hire, and how long your cash will last.",
    mobileHint: "On your phone, open the menu to find Scenarios.",
    action: { label: "Open Scenarios", href: "/scenarios" },
  },
  {
    id: "help",
    targets: ["nav-glossary", "nav-mobile-menu"],
    title: "Help in plain English",
    body:
      "Not sure what a term means? The Glossary explains every number in MyProfitPulse with a simple example.",
    mobileHint: "On your phone, open the menu to find the Glossary.",
    action: { label: "Open Glossary", href: "/glossary" },
  },
  {
    id: "finish",
    targets: ["sample-cta"],
    title: "Now add your real numbers",
    body:
      "Answer a few quick questions (it takes about 2 minutes) to get your own Health Score. The example dashboard goes away when you finish the tour.",
    action: { label: "Start my assessment", href: "/assessment" },
  },
];

export const TOUR_HELP_STEP_WITH_TUTORIALS =
  "Not sure what a term means? The Glossary explains every number in MyProfitPulse with a simple example, and Tutorials opens step-by-step videos in the MyProfitPulse community.";

const INITIAL_STATE: TourState = { status: "not_started", step: 0, updatedAt: new Date(0).toISOString() };

export function tourStorageKey(userId: string): string {
  return `profitpulse_tour_${userId}`;
}

function isTourStatus(value: unknown): value is TourStatus {
  return value === "not_started" || value === "in_progress" || value === "dismissed" || value === "completed";
}

function clampStep(step: unknown): number {
  const n = typeof step === "number" && Number.isFinite(step) ? Math.floor(step) : 0;
  return Math.min(Math.max(n, 0), TOUR_STEPS.length - 1);
}

export function readLocalTourState(userId: string): TourState {
  if (typeof window === "undefined") return INITIAL_STATE;
  try {
    const raw = window.localStorage.getItem(tourStorageKey(userId));
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw) as Partial<TourState>;
    if (!isTourStatus(parsed.status)) return INITIAL_STATE;
    return {
      status: parsed.status,
      step: clampStep(parsed.step),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : INITIAL_STATE.updatedAt,
    };
  } catch {
    return INITIAL_STATE;
  }
}

function writeLocalTourState(userId: string, state: TourState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(tourStorageKey(userId), JSON.stringify(state));
  } catch {
    // Private mode / storage full: the server copy (if any) still applies.
  }
}

/** A finished tour stays finished; otherwise the most recent update wins. */
export function mergeTourStates(a: TourState, b: TourState): TourState {
  if (a.status === "completed") return a;
  if (b.status === "completed") return b;
  return new Date(b.updatedAt).getTime() > new Date(a.updatedAt).getTime() ? b : a;
}

export async function loadTourState(userId: string): Promise<TourState> {
  const local = readLocalTourState(userId);
  try {
    const { getInsForgeClient } = await import("@/lib/insforge");
    const { data, error } = await getInsForgeClient()
      .database.from("onboarding_progress")
      .select("tour_status, tour_step, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data || !isTourStatus(data.tour_status)) return local;
    const remote: TourState = {
      status: data.tour_status,
      step: clampStep(data.tour_step),
      updatedAt: String(data.updated_at),
    };
    const merged = mergeTourStates(local, remote);
    if (merged !== local) writeLocalTourState(userId, merged);
    return merged;
  } catch {
    return local;
  }
}

export async function saveTourState(
  userId: string,
  status: TourStatus,
  step: number
): Promise<TourState> {
  const state: TourState = { status, step: clampStep(step), updatedAt: new Date().toISOString() };
  writeLocalTourState(userId, state);
  try {
    const { getInsForgeClient } = await import("@/lib/insforge");
    await getInsForgeClient()
      .database.from("onboarding_progress")
      .upsert(
        {
          user_id: userId,
          tour_status: state.status,
          tour_step: state.step,
          tour_completed_at: status === "completed" ? state.updatedAt : null,
          updated_at: state.updatedAt,
        },
        { onConflict: "user_id" }
      );
  } catch {
    // Best-effort; see the module comment.
  }
  return state;
}
