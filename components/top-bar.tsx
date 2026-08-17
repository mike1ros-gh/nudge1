"use client";
/* eslint-disable @next/next/no-img-element */

/**
 * Top Bar
 *
 * Instagram connection status. Page identity comes from the sidebar's
 * active-item highlight, so no redundant page title here.
 */

import { useEffect, useState } from "react";

interface TopBarProps {
  instagramUsername: string | null;
  instagramAccountCount: number;
}

export default function TopBar({
  instagramUsername,
  instagramAccountCount,
}: TopBarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (instagramAccountCount !== 1) return;
    let cancelled = false;

    fetch("/api/instagram/profile")
      .then((res) => res.json())
      .then((payload) => {
        if (!cancelled && payload.success && payload.data.profilePictureUrl) {
          setAvatarUrl(payload.data.profilePictureUrl);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [instagramAccountCount]);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-end h-16 px-4 lg:px-8 border-b border-border bg-background">
      {instagramAccountCount > 1 ? (
        <a href="/settings?tab=accounts" className="text-sm text-muted hover:text-foreground">
          {`${instagramAccountCount} accounts`}
        </a>
      ) : instagramAccountCount === 1 ? (
        <a
          href={`https://instagram.com/${instagramUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-6 w-6 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="h-6 w-6 shrink-0 rounded-full bg-surface" />
          )}
          @{instagramUsername}
        </a>
      ) : (
        <a
          href="/api/instagram/connect"
          className="text-sm font-medium px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover"
        >
          Connect Instagram
        </a>
      )}
    </header>
  );
}
