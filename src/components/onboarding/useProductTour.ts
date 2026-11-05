"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hasCompletedOnboarding } from "@/components/BearOnboarding";
import {
  INTRO_COMPLETE_EVENT,
  TOUR_HELP_STEP_WITH_TUTORIALS,
  TOUR_STEPS,
  loadTourState,
  saveTourState,
  type TourState,
  type TourStatus,
  type TourStep,
} from "@/lib/onboarding-tour";
import { getTutorialsUrl } from "@/lib/tutorials";

interface UseProductTourArgs {
  userId: string | undefined;
  /** The account has its own numbers (a health assessment). */
  hasRealData: boolean;
  /** The dashboard has finished loading the account's data. */
  dataLoaded: boolean;
}

export const TOUR_RESTART_PARAM = "tour";

/**
 * Tour lifecycle for the dashboard. Starts on its own for accounts with no
 * numbers yet (after the Pulse intro), shows the example dashboard until the
 * tour is finished or the example is hidden, and can be replayed with
 * /dashboard?tour=restart.
 */
export function useProductTour({ userId, hasRealData, dataLoaded }: UseProductTourArgs) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const [state, setState] = useState<TourState | null>(null);
  const [introDone, setIntroDone] = useState(false);

  const steps: TourStep[] = useMemo(() => {
    if (!getTutorialsUrl()) return TOUR_STEPS;
    return TOUR_STEPS.map((s) => (s.id === "help" ? { ...s, body: TOUR_HELP_STEP_WITH_TUTORIALS } : s));
  }, []);

  useEffect(() => {
    if (!userId) return;
    setIntroDone(hasCompletedOnboarding(userId));
    const onIntroDone = () => setIntroDone(true);
    window.addEventListener(INTRO_COMPLETE_EVENT, onIntroDone);
    return () => window.removeEventListener(INTRO_COMPLETE_EVENT, onIntroDone);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const restart = params.get(TOUR_RESTART_PARAM) === "restart";

    (async () => {
      const loaded = restart ? await saveTourState(userId, "in_progress", 0) : await loadTourState(userId);
      if (!cancelled) setState(loaded);
      if (restart) routerRef.current.replace("/dashboard");
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const update = useCallback(
    async (status: TourStatus, step: number) => {
      if (!userId) return;
      setState({ status, step, updatedAt: new Date().toISOString() });
      setState(await saveTourState(userId, status, step));
    },
    [userId]
  );

  // New, empty accounts start the tour once the intro is out of the way.
  useEffect(() => {
    if (state?.status === "not_started" && dataLoaded && !hasRealData && introDone) {
      void update("in_progress", 0);
    }
  }, [state?.status, dataLoaded, hasRealData, introDone, update]);

  const status = state?.status ?? null;
  const step = state?.step ?? 0;
  const open = Boolean(state && dataLoaded && introDone && status === "in_progress");
  const showSample = Boolean(state && dataLoaded && (open || (!hasRealData && status !== "completed")));

  return {
    steps,
    status,
    step,
    open,
    showSample,
    goTo: (next: number) => update("in_progress", next),
    dismiss: () => update("dismissed", step),
    resume: () => update("in_progress", step),
    complete: () => update("completed", steps.length - 1),
    navigate: async (href: string, nextStep: number) => {
      if (nextStep >= steps.length) await update("completed", steps.length - 1);
      else await update("in_progress", nextStep);
      routerRef.current.push(href);
    },
  };
}
