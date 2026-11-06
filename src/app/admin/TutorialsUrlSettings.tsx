"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui";
import { setSavedTutorialsUrl } from "@/lib/tutorials-settings";
import type { TutorialsUrlSource } from "@/lib/tutorials";
import { getAuthHeaders } from "./admin-utils";

interface TutorialsUrlState {
  saved: string | null;
  effectiveUrl: string | null;
  source: TutorialsUrlSource;
  defaultUrl: string;
  available: boolean;
  error?: string;
}

const SOURCE_TEXT: Record<TutorialsUrlSource, string> = {
  saved: "Using the address saved here.",
  hidden: "The link is hidden. Nothing is saved here, or the saved address isn't a valid web address.",
  env: "Nothing is saved here yet, so it uses the address set in the site's environment settings.",
  default: "Nothing is saved here yet, so it uses the built-in default address.",
};

const INPUT_CLASS =
  "w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20";

export function TutorialsUrlSettings() {
  const { showToast } = useToast();
  const [state, setState] = useState<TutorialsUrlState | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const apply = useCallback((next: TutorialsUrlState) => {
    setState(next);
    setValue(next.saved ?? next.effectiveUrl ?? "");
    setSavedTutorialsUrl(next.saved);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) throw new Error("no session");
        const res = await fetch("/api/admin/tutorials-url", { headers });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as TutorialsUrlState;
        if (!cancelled) {
          setState(data);
          setValue(data.saved ?? data.effectiveUrl ?? "");
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function send(method: "PUT" | "DELETE", body?: { url: string }, doneMessage?: string) {
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        showToast("error", "Your session expired. Sign in again to continue.");
        return;
      }
      const res = await fetch("/api/admin/tutorials-url", {
        method,
        headers: body ? { ...headers, "Content-Type": "application/json" } : headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error || "Couldn't save the Tutorials link.");
        return;
      }
      apply(data as TutorialsUrlState);
      showToast("success", doneMessage ?? "Saved.");
    } catch {
      showToast("error", "Couldn't save the Tutorials link.");
    } finally {
      setBusy(false);
    }
  }

  const trimmed = value.trim();
  const unchanged = state !== null && state.saved !== null && state.saved === trimmed;

  return (
    <section className="mt-4 bg-surface rounded-2xl shadow-card px-5 py-5 sm:px-6">
      <h2 className="text-[17px] font-semibold text-text-primary">Tutorials link</h2>
      <p className="text-[14px] text-text-secondary mt-1 max-w-2xl">
        The Tutorials item under Glossary in the menu opens this page in a new tab. Changes show up for
        everyone the next time they open or refresh the app. No redeploy needed.
      </p>

      {loadFailed && (
        <p role="alert" className="text-[14px] text-error mt-4">
          Couldn&apos;t load the current setting. Refresh to try again.
        </p>
      )}
      {state && !state.available && (
        <p role="alert" className="text-[14px] text-error mt-4 max-w-2xl">
          {state.error}
        </p>
      )}

      {state && (
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            send("PUT", { url: trimmed }, trimmed ? "Tutorials link saved." : "Tutorials link hidden.");
          }}
        >
          <label className="block">
            <span className="block text-[13px] font-medium text-text-secondary mb-1.5">
              Tutorials page address
            </span>
            <input
              type="url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://"
              aria-describedby="tutorials-url-status"
              className={INPUT_CLASS}
            />
          </label>

          <p id="tutorials-url-status" className="text-[13px] text-text-muted">
            {SOURCE_TEXT[state.source]}
            {state.effectiveUrl && (
              <>
                {" "}
                <a
                  href={state.effectiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange hover:underline"
                >
                  Open the page
                </a>
              </>
            )}
          </p>
          <p className="text-[13px] text-text-muted">
            Leave it empty and save to hide the link. It must start with https:// (or http://).
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="submit"
              disabled={busy || unchanged}
              className="px-5 py-2.5 rounded-lg bg-orange text-[14px] font-medium text-white hover:bg-[#D44A00] disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={busy || state.saved === null}
              onClick={() => send("DELETE", undefined, "Back to the default Tutorials link.")}
              className="px-5 py-2.5 rounded-lg border border-border text-[14px] font-medium text-text-secondary hover:bg-surface-inset disabled:opacity-40"
            >
              Use the default
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
