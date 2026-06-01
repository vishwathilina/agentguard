"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CoolIcon, type CoolIconName } from "@/components/icons/CoolIcon";
import { Logo } from "@/components/layout/Logo";

type NavItem = { href: string; label: string; icon: CoolIconName };

const NAV_WORKSPACE: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "chart-line" },
];

const NAV_MANAGE: NavItem[] = [
  { href: "/scans",        label: "Findings",       icon: "shield-warning" },
  { href: "/repositories", label: "Infrastructure", icon: "folder" },
  { href: "/ai-insights",  label: "Intelligence",   icon: "data" },
  { href: "/alerts",       label: "Alerts",         icon: "bell" },
  { href: "/settings",     label: "Settings",       icon: "settings" },
];

function NavLink({
  href,
  label,
  icon,
  active,
  badge,
}: NavItem & { active: boolean; badge?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-3 rounded-lg ag-text-nav transition-all duration-150",
        active
          ? "ag-nav-active font-medium text-white"
          : "text-[var(--ag-text-muted)] hover:text-white font-medium border-l-2 border-transparent"
      )}
    >
      <CoolIcon name={icon} tone={active ? "primary" : "muted"} size={18} />
      <span>{label}</span>
      {badge && (
        <span
          className="ml-auto font-semibold px-1.5 py-0.5 rounded-full"
          style={{
            fontSize: "var(--ag-text-label)",
            background: "color-mix(in srgb, var(--ag-danger) 18%, transparent)",
            color: "var(--ag-danger)",
            border: "1px solid color-mix(in srgb, var(--ag-danger) 35%, transparent)",
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <aside className="w-60 flex flex-col h-screen sticky top-0 shrink-0 ag-card rounded-none border-y-0 border-l-0">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-[var(--ag-border)]">
        <Logo size="sm" href="/dashboard" priority />
        <div className="flex-1 min-w-0">
          <p className="ag-text-brand leading-none">AgentGuard</p>
          <p className="ag-text-meta mt-1">DevSecOps platform</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        <p className="ag-sidebar-group">Workspace</p>
        {NAV_WORKSPACE.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} />
        ))}

        <p className="ag-sidebar-group mt-4">Manage</p>
        {NAV_MANAGE.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={isActive(item.href)}
            badge={item.label === "Alerts" ? "3" : undefined}
          />
        ))}
      </nav>

      {session?.user && (
        <div className="px-3 py-4 border-t border-[var(--ag-border)]">
          <div
            className="flex items-center gap-3 px-2 py-2 rounded-lg"
            style={{ background: "color-mix(in srgb, var(--ag-text) 4%, transparent)" }}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={session.user.image ?? ""} />
              <AvatarFallback
                className="font-semibold text-[#0a0c10]"
                style={{ fontSize: "var(--ag-text-nav)", background: "var(--ag-cyan)" }}
              >
                {session.user.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="ag-text-nav font-semibold text-white truncate">{session.user.name}</p>
              <p className="ag-text-meta truncate">{session.user.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="shrink-0 transition-colors hover:opacity-80"
              title="Sign out"
            >
              <CoolIcon name="log-out" tone="muted" size={15} className="hover:!text-[var(--ag-danger)]" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
