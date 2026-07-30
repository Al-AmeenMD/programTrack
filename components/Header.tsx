"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Layers, Users, ShieldCheck, Settings, Menu, X } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useState, useEffect } from "react";

export function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (!user || pathname === "/login") {
    return null;
  }

  const isActive = (path: string) =>
    path === "/home" ? pathname === "/home" : pathname.startsWith(path);

  const navItems = [
    { href: "/programs", label: "Programs", icon: Layers },
    { href: "/participants", label: "Participants", icon: Users },
    ...(user.role === "admin"
      ? [{ href: "/staff", label: "Staff Accounts", icon: ShieldCheck }]
      : []),
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/home" className="flex items-center space-x-2.5 group">
            <div className="w-8 h-8 rounded-md bg-white p-0.5 shadow-xs flex items-center justify-center overflow-hidden shrink-0 border border-slate-700">
              <img src="/logo.png" alt="ProgramTrack" className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-base tracking-tight text-slate-100">
              ProgramTrack
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center space-x-1.5 ${
                    active
                      ? "bg-slate-800 text-teal-400"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Desktop User Info & Logout */}
          <div className="hidden md:flex items-center space-x-4">
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
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center space-x-1 text-xs font-medium cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>

          {/* Mobile Toggle Button */}
          <div className="flex items-center space-x-2 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-hidden transition cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-800 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium transition ${
                    active
                      ? "bg-slate-800 text-teal-400 font-semibold"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <Icon className="w-5 h-5 text-teal-400 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="pt-3 mt-2 border-t border-slate-800 flex items-center justify-between px-3">
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-medium text-slate-200">{user.full_name}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
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
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-rose-950/80 transition flex items-center space-x-1.5 text-xs font-medium cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
