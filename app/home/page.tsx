"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Layers, Users, ShieldCheck, Settings, RefreshCw, AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

type Counts = {
  programs: number | null;
  participants: number | null;
  staff: number | null;
};

export default function HomePage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts>({ programs: null, participants: null, staff: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchCounts = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch pageSize=1 — we only need meta.total, not the full list
        const requests: Promise<Response>[] = [
          fetch("/api/programs?pageSize=1"),
          fetch("/api/participants?pageSize=1"),
        ];
        if (user.role === "admin") {
          requests.push(fetch("/api/staff?pageSize=1"));
        }

        const responses = await Promise.all(requests);
        const jsons = await Promise.all(responses.map((r) => r.json()));

        setCounts({
          programs: jsons[0]?.meta?.total ?? null,
          participants: jsons[1]?.meta?.total ?? null,
          staff: user.role === "admin" ? (jsons[2]?.meta?.total ?? null) : null,
        });
      } catch {
        setError("Could not load dashboard counts.");
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, [user]);

  if (!user) return null;

  const isAdmin = user.role === "admin";

  return (
    <div className="space-y-6 py-4">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Welcome back, {user.full_name.split(" ")[0]}
        </h1>
        <p className="text-sm text-slate-500">
          {isAdmin
            ? "System overview — all programs and participants."
            : "Your assigned programs and participants."}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tiles Grid — all four use teal icon backgrounds for consistency */}
      <div className={`grid gap-4 ${isAdmin ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>

        {/* Programs Tile */}
        <Link
          href="/programs"
          className="group bg-white rounded-lg border border-slate-200 shadow-xs p-5 hover:border-teal-300 hover:shadow-sm transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-md bg-teal-50 border border-teal-200 flex items-center justify-center group-hover:bg-teal-100 transition">
              <Layers className="w-[18px] h-[18px] text-teal-700" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {isAdmin ? "All Programs" : "Your Programs"}
            </span>
          </div>
          <div>
            {loading ? (
              <RefreshCw className="w-4 h-4 text-slate-300 animate-spin" />
            ) : (
              <p className="text-3xl font-bold text-slate-900 tabular-nums">
                {counts.programs ?? "—"}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Programs</p>
          </div>
        </Link>

        {/* Participants Tile */}
        <Link
          href="/participants"
          className="group bg-white rounded-lg border border-slate-200 shadow-xs p-5 hover:border-teal-300 hover:shadow-sm transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-md bg-teal-50 border border-teal-200 flex items-center justify-center group-hover:bg-teal-100 transition">
              <Users className="w-[18px] h-[18px] text-teal-700" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {isAdmin ? "All Participants" : "Your Participants"}
            </span>
          </div>
          <div>
            {loading ? (
              <RefreshCw className="w-4 h-4 text-slate-300 animate-spin" />
            ) : (
              <p className="text-3xl font-bold text-slate-900 tabular-nums">
                {counts.participants ?? "—"}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Participants</p>
          </div>
        </Link>

        {/* Staff Accounts Tile — admin only, never rendered for facilitators */}
        {isAdmin && (
          <Link
            href="/staff"
            className="group bg-white rounded-lg border border-slate-200 shadow-xs p-5 hover:border-teal-300 hover:shadow-sm transition-all space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-md bg-teal-50 border border-teal-200 flex items-center justify-center group-hover:bg-teal-100 transition">
                <ShieldCheck className="w-[18px] h-[18px] text-teal-700" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                All Staff
              </span>
            </div>
            <div>
              {loading ? (
                <RefreshCw className="w-4 h-4 text-slate-300 animate-spin" />
              ) : (
                <p className="text-3xl font-bold text-slate-900 tabular-nums">
                  {counts.staff ?? "—"}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Staff Accounts</p>
            </div>
          </Link>
        )}

        {/* Settings Tile — personal account, no count */}
        <Link
          href="/settings"
          className="group bg-white rounded-lg border border-slate-200 shadow-xs p-5 hover:border-teal-300 hover:shadow-sm transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-md bg-teal-50 border border-teal-200 flex items-center justify-center group-hover:bg-teal-100 transition">
              <Settings className="w-[18px] h-[18px] text-teal-700" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Account
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700 mt-1">Manage account</p>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Settings</p>
          </div>
        </Link>
      </div>

      {/* Footer note — keeps page from feeling sparse */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs text-slate-400">
        <span>Signed in as <span className="font-semibold text-slate-600">{user.full_name}</span> · <span className="capitalize">{user.role}</span></span>
        <Link href="/settings" className="flex items-center space-x-1 hover:text-teal-700 transition font-medium">
          <span>Account settings</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
