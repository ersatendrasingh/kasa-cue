import { auth } from "@/auth";
import { AudioLines, LayoutDashboard, LogIn, UserRound } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export async function MarketingHeader({ dark = false }: { dark?: boolean }) {
  const session = await auth();
  const dashboardHref = session?.user?.role === "admin" ? "/admin" : "/dashboard";
  const userInitial = getInitial(session?.user?.name, session?.user?.email);
  const linkClass = dark
    ? "text-slate-200 hover:text-white"
    : "text-slate-600 hover:text-slate-950";
  const shellClass = dark
    ? "border-white/10 bg-slate-950/90 text-white"
    : "border-slate-200 bg-white/95 text-slate-950";

  return (
    <header className={`sticky top-0 z-50 border-b backdrop-blur ${shellClass}`}>
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-3" href="/">
          <img alt="Kasa Cue" className="size-10 rounded-lg" src="/kasa-icon.png" />
          <span className="text-lg font-semibold">Kasa Cue</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          <Link className={linkClass} href="/how-it-works">
            How it works
          </Link>
          <Link className={linkClass} href="/compare-plans">
            Compare
          </Link>
          <Link className={linkClass} href="/pricing">
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {session?.user ? (
            <>
              <Link
                className={`hidden h-10 items-center gap-2 rounded-full px-2.5 pr-4 text-sm font-semibold sm:inline-flex ${
                  dark ? "hover:bg-white/10" : "hover:bg-slate-100"
                }`}
                href={dashboardHref}
              >
                <Avatar className="size-8 ring-1 ring-white/15">
                  <AvatarImage alt={session.user.name ?? "Kasa Cue user"} src={session.user.image ?? ""} />
                  <AvatarFallback className={dark ? "bg-white text-slate-950" : "bg-slate-950 text-white"}>
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                Dashboard
              </Link>
              <Link
                aria-label="Open dashboard"
                className={`inline-flex size-10 items-center justify-center rounded-full border sm:hidden ${
                  dark
                    ? "border-white/15 text-white hover:bg-white/10"
                    : "border-slate-200 text-slate-950 hover:bg-slate-100"
                }`}
                href={dashboardHref}
              >
                <LayoutDashboard className="size-4" />
              </Link>
            </>
          ) : (
            <>
              <Link
                className={`hidden h-10 items-center gap-2 rounded-full px-2.5 pr-4 text-sm font-semibold sm:inline-flex ${
                  dark ? "hover:bg-white/10" : "hover:bg-slate-100"
                }`}
                href="/login"
              >
                <Avatar className="size-8 ring-1 ring-white/15">
                  <AvatarImage alt="Kasa Cue" src="/kasa-icon.png" />
                  <AvatarFallback>
                    <UserRound className="size-4" />
                  </AvatarFallback>
                </Avatar>
                Sign in
              </Link>
              <Link
                aria-label="Open login"
                className={`inline-flex size-10 items-center justify-center rounded-full border sm:hidden ${
                  dark
                    ? "border-white/15 text-white hover:bg-white/10"
                    : "border-slate-200 text-slate-950 hover:bg-slate-100"
                }`}
                href="/login"
              >
                <LogIn className="size-4" />
              </Link>
              <Link
                className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold ${
                  dark
                    ? "bg-white text-slate-950 hover:bg-emerald-100"
                    : "bg-slate-950 text-white hover:bg-slate-800"
                }`}
                href="/signup"
              >
                Start
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function getInitial(name?: null | string, email?: null | string) {
  return (name?.trim() || email?.trim() || "K").slice(0, 1).toUpperCase();
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <Link className="flex items-center gap-3 font-semibold" href="/">
            <img alt="Kasa Cue" className="size-10 rounded-lg" src="/kasa-icon.png" />
            Kasa Cue
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">
            Live communication support for office meetings, client calls,
            daily standups, project KT, and everyday workplace conversations.
          </p>
        </div>
        <FooterGroup title="Product" links={[["How it works", "/how-it-works"], ["Pricing", "/pricing"], ["Compare plans", "/compare-plans"]]} />
        <FooterGroup title="Workspace" links={[["Sign in", "/login"], ["Create account", "/signup"], ["Dashboard", "/dashboard"]]} />
        <div>
          <p className="text-sm font-semibold">Desktop</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              href="/api/desktop/download?platform=mac-arm64"
            >
              <AudioLines className="size-4" />
              Mac M-series
            </a>
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              href="/api/desktop/download?platform=mac-x64"
            >
              <AudioLines className="size-4" />
              Intel Mac
            </a>
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              href="/api/desktop/download?platform=windows-x64"
            >
              <AudioLines className="size-4" />
              Windows
            </a>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-2 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Kasa Cue. All rights reserved.</p>
        <p>Built for calm, private, real-time communication.</p>
      </div>
    </footer>
  );
}

function FooterGroup({
  links,
  title,
}: {
  links: Array<[string, string]>;
  title: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600">
        {links.map(([label, href]) => (
          <Link className="hover:text-slate-950" href={href} key={href}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
