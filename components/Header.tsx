"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Layers, Users, ShieldCheck, Settings } from "lucide-react";
import { useAuth } from "./AuthProvider";

export function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user || pathname === "/login") {
    return null;
  }

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link href="/programs" className="flex items-center space-x-2.5 group">
            <div className="w-8 h-8 rounded bg-teal-700 flex items-center justify-center font-bold text-white text-sm tracking-wider group-hover:bg-teal-600 transition">
              PT
            </div>
            <span className="font-semibold text-base tracking-tight text-slate-100">
              ProgramTrack
            </span>
          </Link>

          <nav className="flex items-center space-x-1">
            <Link
              href="/programs"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center space-x-1.5 ${
                isActive("/programs")
                  ? "bg-slate-800 text-teal-400"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Programs</span>
            </Link>

            <Link
              href="/participants"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center space-x-1.5 ${
                isActive("/participants")
                  ? "bg-slate-800 text-teal-400"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Participants</span>
            </Link>

            {user.role === "admin" && (
              <Link
                href="/staff"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center space-x-1.5 ${
                  isActive("/staff")
                    ? "bg-slate-800 text-teal-400"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Staff Accounts</span>
              </Link>
            )}

            <Link
              href="/settings"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center space-x-1.5 ${
                isActive("/settings")
                  ? "bg-slate-800 text-teal-400"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5 text-xs">
            <span className="font-medium text-slate-200">{user.full_name}</span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                user.role === "admin"
                  ? "bg-slate-700 text-slate-200 border border-slate-600"
                  : "bg-teal-950 text-teal-300 border border-teal-800"
              }`}
            >
              {user.role}
            </span>
          </div>

          <button
            onClick={logout}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center space-x-1 text-xs font-medium"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
