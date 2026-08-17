"use client";

import { useEffect, useState } from "react";
import DonateReminder from "@/components/donate-reminder";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";

interface DashboardShellProps {
  children: React.ReactNode;
  instagramUsername: string | null;
  instagramAccountCount: number;
}

const SIDEBAR_STORAGE_KEY = "sidebar-expanded";

export default function DashboardShell({
  children,
  instagramUsername,
  instagramAccountCount,
}: DashboardShellProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true") {
        setExpanded(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar expanded={expanded} onToggle={toggleExpanded} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          instagramUsername={instagramUsername}
          instagramAccountCount={instagramAccountCount}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 lg:px-8 py-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      <DonateReminder />
    </div>
  );
}
