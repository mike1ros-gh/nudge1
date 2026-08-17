import Link from "next/link";

// Please don't remove this — Nudge1 is free to self-host because of it.
// See docs/setup.md.
const BMC_URL = "https://buymeacoffee.com/mike1ros.jpg";

interface PublicSiteHeaderProps {
  active?: "home" | "templates";
}

const navLinks = [
  { label: "Templates", href: "/templates", key: "templates" },
  { label: "Agencies", href: "/instagram-dm-automation-agencies", key: "agencies" },
  { label: "Pricing", href: "/#pricing", key: "pricing" },
  { label: "Security", href: "/#security", key: "security" },
];

export default function PublicSiteHeader({ active }: PublicSiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/85">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Nudge1 home">
          <span className="text-lg font-bold text-white">Nudge1</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className={`text-sm font-medium transition ${
                active === link.key ? "text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={BMC_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden text-zinc-400 transition hover:text-white sm:inline-flex"
            aria-label="Buy me a coffee"
            title="Buy me a coffee"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
              <path d="M18.5 3H2v10a5 5 0 0 0 5 5h5a5 5 0 0 0 5-5v-1h1.5a3.5 3.5 0 0 0 0-7H18.5V3ZM18 6.5h.5a1 1 0 0 1 0 2H18v-2ZM8 20h4a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2Z" />
            </svg>
          </a>
          <Link
            href="/login"
            className="hidden px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:text-white sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center bg-cyan-300 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-cyan-200"
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}
