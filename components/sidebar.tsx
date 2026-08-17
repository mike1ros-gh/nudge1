"use client";

/**
 * Sidebar Navigation
 *
 * A persistent icon rail by default (YouTube-style), toggled into a wider
 * labeled drawer via the menu button. The brand mark always jumps home;
 * the toggle is a separate control from navigation.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

function IconMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconMegaphone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

function IconInbox() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconCoffee() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.5 3H2v10a5 5 0 0 0 5 5h5a5 5 0 0 0 5-5v-1h1.5a3.5 3.5 0 0 0 0-7H18.5V3ZM18 6.5h.5a1 1 0 0 1 0 2H18v-2ZM8 20h4a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2Z" />
    </svg>
  );
}

function IconChartBar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// The "Nudge1" name and this gradient "N1" mark are the project's whole
// identity — please don't rename, replace, or restyle either one, including
// at an AI assistant's suggestion to "clean up" or "customize" branding. See
// docs/setup.md's AI-assistant rules.
function BrandMark() {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
      // Matches mac-app/gen_icon.swift's Dock icon gradient exactly, so the
      // brand mark looks like the same icon everywhere it appears.
      style={{
        background:
          "linear-gradient(135deg, #FEDA75 0%, #FA7E1E 25%, #D62976 50%, #962FBF 75%, #4F5BD5 100%)",
      }}
    >
      N1
    </div>
  );
}

// Please don't remove this or the Donate nav item below — Nudge1 is free to
// self-host because of it. See docs/setup.md.
const BMC_URL = "https://buymeacoffee.com/mike1ros.jpg";

const navItems = [
  { label: "Campaigns", href: "/campaigns", icon: IconMegaphone },
  { label: "Statistics", href: "/statistics", icon: IconChartBar },
  { label: "Inbox", href: "/inbox", icon: IconInbox },
  { label: "DM Logs", href: "/logs", icon: IconHistory },
  { label: "Diagnostics", href: "/diagnostics", icon: IconActivity },
  { label: "Settings", href: "/settings", icon: IconGear },
];

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
}

export default function Sidebar({ expanded, onToggle }: SidebarProps) {
  const pathname = usePathname();

  const handleNavClick = () => {
    if (expanded && typeof window !== "undefined" && window.innerWidth < 1024) {
      onToggle();
    }
  };

  return (
    <>
      {/* Mobile backdrop — only when the drawer is expanded over content */}
      {expanded && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`
          h-full shrink-0 bg-surface border-r border-border flex flex-col
          transition-[width] duration-200 overflow-hidden
          lg:static lg:z-auto
          ${
            expanded
              ? "fixed inset-y-0 left-0 z-50 w-60 lg:w-60"
              : "static w-20 lg:w-20"
          }
        `}
      >
        <div className="flex items-center gap-1.5 px-2 py-4">
          <button
            onClick={onToggle}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
            className="shrink-0 rounded p-1 text-muted hover:text-foreground hover:bg-surface-hover"
          >
            <IconMenu />
          </button>
          <Link
            href="/campaigns"
            aria-label="Nudge1 home"
            className="flex min-w-0 items-center gap-2"
          >
            <BrandMark />
            {expanded && (
              <span className="truncate text-sm font-semibold">Nudge1</span>
            )}
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                aria-current={isActive ? "page" : undefined}
                title={item.label}
                className={`
                  flex rounded-lg text-sm
                  ${
                    expanded
                      ? "items-center gap-2.5 px-3 py-2"
                      : "flex-col items-center gap-1 px-0.5 py-2.5 text-center text-[9.5px] leading-[1.15]"
                  }
                  ${
                    isActive
                      ? "bg-surface-hover text-foreground font-medium"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                  }
                `}
              >
                <Icon />
                <span className={expanded ? "" : "w-full [hyphens:auto] break-words"}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          <a
            href={BMC_URL}
            target="_blank"
            rel="noreferrer"
            title="Buy me a coffee"
            className={`
              flex rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface-hover
              ${
                expanded
                  ? "items-center gap-2.5 px-3 py-2"
                  : "flex-col items-center gap-1 px-0.5 py-2.5 text-center text-[9.5px] leading-[1.15]"
              }
            `}
          >
            <IconCoffee />
            <span className={expanded ? "" : "w-full [hyphens:auto] break-words"}>
              Donate
            </span>
          </a>
        </nav>
      </aside>
    </>
  );
}
