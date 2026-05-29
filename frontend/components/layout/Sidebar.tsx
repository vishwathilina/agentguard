"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  ScanLine,
  Brain,
  Bell,
  Server,
  Settings,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navItems = [
  { href: "/dashboard",     label: "Dashboard",      icon: LayoutDashboard },
  { href: "/scans",         label: "Scans",           icon: ScanLine },
  { href: "/repositories",  label: "Repositories",    icon: Server },
  { href: "/ai-insights",   label: "AI Insights",     icon: Brain },
  { href: "/alerts",        label: "Alerts",          icon: Bell },
  { href: "/settings",      label: "Settings",        icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="w-60 flex flex-col h-screen sticky top-0 shrink-0"
      style={{ background: "#161b22", borderRight: "1px solid #30363d" }}>

      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: "1px solid #30363d" }}>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)" }}>
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white leading-none">AgentGuard</p>
          <p className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>AI DevSecOps Scanner</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "text-white"
                  : "hover:text-white"
              )}
              style={
                active
                  ? { background: "rgba(99,102,241,0.18)", color: "#fff", borderLeft: "2px solid #6366f1" }
                  : { color: "#8b949e", borderLeft: "2px solid transparent" }
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
              {label === "Alerts" && (
                <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(239,68,68,0.2)", color: "#f87171" }}>
                  3
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      {session?.user && (
        <div className="px-3 py-4" style={{ borderTop: "1px solid #30363d" }}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg"
            style={{ background: "rgba(255,255,255,0.03)" }}>
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={session.user.image ?? ""} />
              <AvatarFallback className="text-xs font-semibold"
                style={{ background: "#6366f1", color: "#fff" }}>
                {session.user.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{session.user.name}</p>
              <p className="text-[10px] truncate" style={{ color: "#8b949e" }}>{session.user.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="shrink-0 transition-colors hover:text-red-400"
              style={{ color: "#8b949e" }}
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
