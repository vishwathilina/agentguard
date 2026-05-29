"use client";

import { Bell, MessageSquare, Settings, Search, ChevronDown } from "lucide-react";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";

export function TopHeader() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");

  return (
    <header
      className="flex items-center justify-between px-6 py-3 shrink-0"
      style={{ background: "#161b22", borderBottom: "1px solid #30363d", height: "56px" }}
    >
      {/* Search */}
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "#6e7681" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full pl-9 pr-3 py-1.5 rounded-lg text-sm outline-none transition-colors"
          style={{
            background: "#0d1117",
            border: "1px solid #30363d",
            color: "#c9d1d9",
          }}
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Bell */}
        <button
          className="relative p-2 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: "#8b949e" }}
        >
          <Bell className="h-4 w-4" />
          <span
            className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full"
            style={{ background: "#f87171" }}
          />
        </button>

        {/* Message */}
        <button
          className="p-2 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: "#8b949e" }}
        >
          <MessageSquare className="h-4 w-4" />
        </button>

        {/* Divider */}
        <div className="mx-2 h-5 w-px" style={{ background: "#30363d" }} />

        {/* User */}
        <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-white/5">
          <Avatar className="h-6 w-6">
            <AvatarImage src={session?.user?.image ?? ""} />
            <AvatarFallback className="text-[10px]"
              style={{ background: "#6366f1", color: "#fff" }}>
              {session?.user?.name?.charAt(0).toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium" style={{ color: "#c9d1d9" }}>
            {session?.user?.name?.split(" ")[0] ?? "User"}
          </span>
          <ChevronDown className="h-3 w-3" style={{ color: "#6e7681" }} />
        </button>

        {/* Divider */}
        <div className="mx-2 h-5 w-px" style={{ background: "#30363d" }} />

        {/* Settings */}
        <button
          className="p-2 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: "#8b949e" }}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
