"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers, Users, ShieldCheck, Settings, RefreshCw, AlertCircle, ArrowRight, BarChart3, BookOpen, UsersRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

type Counts = {
  programs: number | null;
  participants: number | null;
  staff: number | null;
};

type FacilitatorCourseCard = {
  course_id: string;
  course_name: string;
  program_id: string;
  program_name: string;
  program_status: string;
  my_participants_count: number;
  total_participants_count: number;
  group_names: string[];
  has_group_restriction: boolean;
};

export default function HomePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [counts, setCounts] = useState<Counts>({ programs: null, participants: null, staff: null });
  const [assignedCourses, setAssignedCourses] = useState<FacilitatorCourseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?clear=1");
      return;
    }

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

    const fetchFacilitatorCourses = async () => {
      if (user.role !== "facilitator") return;
      setLoadingCourses(true);
      try {
        const res = await fetch("/api/dashboard/facilitator-courses");
        if (res.ok) {
          const json = await res.json();
          setAssignedCourses(json.data || []);
        }
      } catch (err) {
        console.error("Error loading assigned courses:", err);
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchCounts();
    if (user.role === "facilitator") {
      fetchFacilitatorCourses();
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
        <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-800">Authentication Required</h2>
          <p className="text-xs text-slate-500 max-w-sm">
            Your session has expired or you are not signed in. Please sign in to access ProgramTrack.
          </p>
        </div>
        <a
          href="/login?clear=1"
          onClick={async () => {
            await logout();
          }}
          className="inline-flex items-center justify-center px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-md shadow-xs transition cursor-pointer"
        >
          Go to Sign In
        </a>
      </div>
    );
  }

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
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <a
            href="/login?clear=1"
            onClick={async () => {
              await logout();
            }}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded text-[11px] transition cursor-pointer"
          >
            Return to Login
          </a>
        </div>
      )}

      {/* Tiles Grid — responsive mobile-first layout */}
      <div className={`grid gap-3.5 sm:gap-4 ${isAdmin ? "grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4" : "grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4"}`}>

        {/* Analytics Tile */}
        <Link
          href="/dashboard"
          className="group bg-white rounded-lg border border-slate-200 shadow-xs p-5 hover:border-teal-300 hover:shadow-sm transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-md bg-teal-50 border border-teal-200 flex items-center justify-center group-hover:bg-teal-100 transition">
              <BarChart3 className="w-[18px] h-[18px] text-teal-700" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Analytics
            </span>
          </div>
          <div>
            <p className="text-base font-bold text-slate-900 mt-1 flex items-center justify-between">
              <span>Analytics</span>
              <ArrowRight className="w-4 h-4 text-teal-600 opacity-0 group-hover:opacity-100 transition" />
            </p>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Dashboard Reports</p>
          </div>
        </Link>

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

      {/* Facilitator Assigned Courses */}
      {!isAdmin && (
        <div className="space-y-3.5 pt-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-700" />
                <span>Your Assigned Courses</span>
              </h2>
              <p className="text-xs text-slate-500">
                Direct access to course sessions, attendance rosters, and your participants.
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {assignedCourses.length} {assignedCourses.length === 1 ? "course" : "courses"}
            </span>
          </div>

          {loadingCourses ? (
            <div className="p-8 text-center bg-white rounded-lg border border-slate-200 text-xs text-slate-500 flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
              <span>Loading assigned courses...</span>
            </div>
          ) : assignedCourses.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-lg border border-dashed border-slate-200 text-xs text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">No courses assigned yet</p>
              <p className="text-slate-400">An administrator will assign you to courses and groups.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedCourses.map((c) => (
                <Link
                  key={c.course_id}
                  href={`/programs/${c.program_id}/courses/${c.course_id}`}
                  className="group bg-white rounded-lg border border-slate-200 shadow-xs hover:border-teal-400 hover:shadow-sm transition-all p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[70%]" title={c.program_name}>
                        {c.program_name}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border capitalize ${
                          c.program_status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : c.program_status === "completed"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {c.program_status}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-teal-700 transition">
                        {c.course_name}
                      </h3>
                      <ArrowRight className="w-4 h-4 text-teal-600 opacity-0 group-hover:opacity-100 transition shrink-0 mt-1" />
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <UsersRound className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-800">
                        {c.my_participants_count} out of {c.total_participants_count} participants
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.has_group_restriction ? (
                        <>
                          <span className="text-[11px] text-slate-400">Assigned groups:</span>
                          {c.group_names.map((name) => (
                            <span
                              key={name}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200"
                            >
                              {name}
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          All groups (full course access)
                        </span>
                      )}
                    </div>

                    <div className="pt-2 text-[11px] font-semibold text-teal-700 flex items-center gap-1 group-hover:underline">
                      <span>Manage course sessions & attendance</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer note — keeps page from feeling sparse */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs text-slate-400">
        <span>Signed in as <span className="font-semibold text-slate-600">{user.full_name}</span> · <span className="capitalize">{user.role}</span></span>
        <Link href="/settings" className="flex items-center space-x-1 hover:text-teal-700 transition font-medium">
          <span>Account settings</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
