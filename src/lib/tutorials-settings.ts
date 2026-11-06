"use client";

import { useEffect, useSyncExternalStore } from "react";
import { TUTORIALS_URL_SETTING_KEY, resolveTutorialsUrl } from "@/lib/tutorials";

/**
 * Browser side of the admin-editable Tutorials link. The saved address is read
 * once per page load and shared by every component that needs it (each page
 * mounts its own layout, so without this the link would blink on every page
 * change). Until it has loaded the link stays hidden, so a link an admin has
 * removed never flashes.
 */

interface SettingsState {
  loaded: boolean;
  /** undefined/null: nothing saved. "": an admin cleared it on purpose. */
  saved: string | null;
}

const UNLOADED: SettingsState = { loaded: false, saved: null };

let state: SettingsState = UNLOADED;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: SettingsState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function fetchSaved(): Promise<string | null> {
  try {
    const { getInsForgeClient } = await import("@/lib/insforge");
    const { data, error } = await getInsForgeClient()
      .database.from("app_settings")
      .select("value")
      .eq("key", TUTORIALS_URL_SETTING_KEY)
      .maybeSingle();
    if (error || !data || typeof data.value !== "string") return null;
    return data.value;
  } catch {
    // Not set up yet (table missing) or offline: fall back to the default.
    return null;
  }
}

export function loadTutorialsSetting(): Promise<void> {
  if (state.loaded) return Promise.resolve();
  if (!inflight) {
    inflight = fetchSaved().then((saved) => {
      inflight = null;
      publish({ loaded: true, saved });
    });
  }
  return inflight;
}

/** Called by the admin screen after a save so this browser updates at once. */
export function setSavedTutorialsUrl(saved: string | null): void {
  publish({ loaded: true, saved });
}

export function resetTutorialsSettingsForTests(): void {
  inflight = null;
  state = UNLOADED;
  listeners.clear();
}

/** The Tutorials address to link to, or null when the link should be hidden. */
export function useTutorialsUrl(): string | null {
  const current = useSyncExternalStore(
    subscribe,
    () => state,
    () => UNLOADED
  );
  useEffect(() => {
    void loadTutorialsSetting();
  }, []);
  return current.loaded ? resolveTutorialsUrl(current.saved) : null;
}
