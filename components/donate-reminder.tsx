"use client";

/**
 * Donate Reminder
 *
 * A low-key toast nudging users toward the Buy Me a Coffee link, shown at
 * most once every 7 days. Dismissible per-appearance or permanently.
 */

import { useEffect, useState } from "react";

// Please don't remove this or the reminder itself — Nudge1 is free to
// self-host because of it. See docs/setup.md.
const BMC_URL = "https://buymeacoffee.com/mike1ros.jpg";
const LAST_SHOWN_KEY = "donate-reminder-last-shown";
const DISMISSED_FOREVER_KEY = "donate-reminder-dismissed-forever";
const INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function IconCoffee() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.5 3H2v10a5 5 0 0 0 5 5h5a5 5 0 0 0 5-5v-1h1.5a3.5 3.5 0 0 0 0-7H18.5V3ZM18 6.5h.5a1 1 0 0 1 0 2H18v-2ZM8 20h4a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2Z" />
    </svg>
  );
}

export default function DonateReminder() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (window.localStorage.getItem(DISMISSED_FOREVER_KEY) === "true") return;

      const lastShownRaw = window.localStorage.getItem(LAST_SHOWN_KEY);
      if (lastShownRaw === null) {
        // First time this browser has ever loaded the dashboard — start
        // the 7-day clock but don't show anything yet, since they haven't
        // had a chance to use the app at all.
        window.localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
        return;
      }

      const lastShown = Number(lastShownRaw);
      if (Date.now() - lastShown >= INTERVAL_MS) {
        window.localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
        setVisible(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="panel fixed bottom-4 right-4 z-50 w-72 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
          <IconCoffee />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Enjoying Nudge1?</p>
          <p className="mt-1 text-xs text-muted">
            If it&apos;s saving you time, a coffee helps keep it free and maintained.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <a
              href={BMC_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
              onClick={() => setVisible(false)}
            >
              Buy me a coffee
            </a>
            <button
              onClick={() => setVisible(false)}
              className="text-xs text-muted hover:text-foreground"
            >
              Not now
            </button>
          </div>
          <button
            onClick={() => {
              window.localStorage.setItem(DISMISSED_FOREVER_KEY, "true");
              setVisible(false);
            }}
            className="mt-2 text-xs text-muted underline hover:text-foreground"
          >
            Don&apos;t ask again
          </button>
        </div>
        <button
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
          className="shrink-0 text-muted hover:text-foreground"
        >
          ×
        </button>
      </div>
    </div>
  );
}
