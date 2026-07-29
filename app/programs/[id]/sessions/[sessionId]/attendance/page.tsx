"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  Filter,
  CheckCheck,
  Search,
  BookOpen,
} from "lucide-react";
import { Modal } from "@/components/ui/Dialog";
import { useAuth } from "@/components/AuthProvider";

type Course = {
  id: string;
  name: string;
};

type SessionDetail = {
  id: string;
  program_id: string;
  title: string;
  session_date: string;
  is_active: boolean;
  program?: {
    id: string;
    name: string;
  };
};

type Participant = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

type AttendanceRecord = {
  id: string;
  status: "present" | "absent" | "late" | "excused";
  marked_at: string;
  marked_by: string | null;
};

type AttendanceItem = {
  enrollment_id: string;
  participant: Participant;
  course_id: string | null;
  course: Course | null;
  enrollment_status: string;
  attendance_record: AttendanceRecord | null;
};

type RouteContext = {
  params: Promise<{
    id: string;
    sessionId: string;
  }>;
};

export default function AttendanceMarkingPage({ params }: RouteContext) {
  const { id: programId, sessionId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [roster, setRoster] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("all");
  const [facilitatorAssignedCourses, setFacilitatorAssignedCourses] = useState<string[]>([]);

  // Mark All Present Modal State
  const [isMarkAllOpen, setIsMarkAllOpen] = useState(false);
  const [markAllExceptions, setMarkAllExceptions] = useState<Record<string, "absent" | "late" | "excused" | "exclude">>({});
  const [markAllLoading, setMarkAllLoading] = useState(false);

  const fetchSessionData = async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load session details");
      setSession(json.data);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to load session");
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await fetch(`/api/programs/${programId}/courses`);
      const json = await res.json();
      if (res.ok) setCourses(json.data || []);
    } catch {
      // Ignore
    }
  };

  const fetchRoster = async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/attendance`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load attendance roster");
      setRoster(json.data || []);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to load attendance roster");
    }
  };

  // Determine facilitator assigned courses and set sensible default filter
  useEffect(() => {
    if (user?.role === "facilitator" && user.id) {
      const fetchStaffAssignments = async () => {
        try {
          const res = await fetch("/api/staff");
          const json = await res.json();
          if (res.ok && json.data) {
            const me = json.data.find((s: { id: string }) => s.id === user.id);
            if (me?.program_staff) {
              const ps = me.program_staff.find((p: { program_id: string }) => p.program_id === programId);
              if (ps?.courses && ps.courses.length > 0) {
                const assignedIds = ps.courses.map((c: { course_id: string }) => c.course_id);
                setFacilitatorAssignedCourses(assignedIds);
                if (assignedIds.length > 0) {
                  setSelectedCourseFilter(assignedIds[0]);
                }
              }
            }
          }
        } catch {
          // Ignore
        }
      };
      fetchStaffAssignments();
    }
  }, [user, programId]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);
      await Promise.all([fetchSessionData(), fetchCourses(), fetchRoster()]);
      setLoading(false);
    };
    init();
  }, [sessionId, programId]);

  const handleMarkStatus = async (enrollmentId: string, status: "present" | "absent" | "late" | "excused") => {
    setSavingId(enrollmentId);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: [{ enrollment_id: enrollmentId, status }],
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update attendance");

      // Optimistically update local state
      setRoster((prev) =>
        prev.map((item) =>
          item.enrollment_id === enrollmentId
            ? {
                ...item,
                attendance_record: {
                  id: item.attendance_record?.id || "temp",
                  status,
                  marked_at: new Date().toISOString(),
                  marked_by: user?.id || null,
                },
              }
            : item
        )
      );
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to update attendance");
    } finally {
      setSavingId(null);
    }
  };

  const handleMarkAllPresentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMarkAllLoading(true);

    try {
      const exceptPayload = Object.entries(markAllExceptions)
        .filter(([, action]) => action !== "exclude")
        .map(([enrollmentId, action]) => ({
          enrollment_id: enrollmentId,
          status: action as "absent" | "late" | "excused",
        }));

      // Also add excluded enrollment ids as plain strings
      const excludedIds = Object.entries(markAllExceptions)
        .filter(([, action]) => action === "exclude")
        .map(([enrollmentId]) => enrollmentId);

      const res = await fetch(`/api/sessions/${sessionId}/attendance/mark-all-present`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          except: [...exceptPayload, ...excludedIds],
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to mark all present");

      setIsMarkAllOpen(false);
      setMarkAllExceptions({});
      await fetchRoster();
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to mark all present");
    } finally {
      setMarkAllLoading(false);
    }
  };

  // Filtered Roster
  const filteredRoster = roster.filter((item) => {
    const matchesSearch =
      !search.trim() ||
      item.participant.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (item.participant.email && item.participant.email.toLowerCase().includes(search.toLowerCase()));

    const matchesCourse =
      selectedCourseFilter === "all"
        ? true
        : selectedCourseFilter === "unassigned"
        ? !item.course_id
        : item.course_id === selectedCourseFilter;

    return matchesSearch && matchesCourse;
  });

  const totalCount = roster.length;
  const markedCount = roster.filter((i) => i.attendance_record !== null).length;
  const unmarkedCount = totalCount - markedCount;
  const progressPercent = totalCount > 0 ? Math.round((markedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
        <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
        <span>Loading session attendance sheet...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-12 text-center text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-md">
        <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-2" />
        <span className="font-bold text-sm block mb-1">Session Not Found</span>
        <span>The requested session could not be loaded.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="space-y-3 pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <Link
            href={`/programs/${programId}?tab=sessions`}
            className="hover:text-teal-700 flex items-center space-x-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>{session.program?.name || "Program"} Sessions</span>
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-semibold">{session.title}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-teal-700" />
              <span>{session.title}</span>
              {!session.is_active && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border bg-slate-100 text-slate-600 border-slate-300">
                  Inactive
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Date: <span className="font-semibold text-slate-800">{new Date(session.session_date).toLocaleDateString()}</span> · Program: <span className="font-semibold text-slate-800">{session.program?.name}</span>
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setIsMarkAllOpen(true);
                setMarkAllExceptions({});
              }}
              disabled={!session.is_active}
              title={!session.is_active ? "Session is inactive — attendance is read-only" : undefined}
              className={`px-3 py-1.5 font-medium text-xs rounded-md shadow-xs transition flex items-center space-x-1.5 ${
                session.is_active
                  ? "bg-teal-700 hover:bg-teal-800 text-white"
                  : "bg-slate-100 text-slate-400 border border-slate-300 cursor-not-allowed"
              }`}
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark Unmarked as Present</span>
            </button>
          </div>
        </div>

        {!session.is_active && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span><span className="font-bold">Read-only view.</span> This session has been deactivated. Historical attendance records are visible but cannot be added or changed.</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Progress Bar & Quick Stats */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3">
            <span className="font-bold text-slate-900">Attendance Marking Progress:</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono font-bold">
              {markedCount} / {totalCount} Marked ({progressPercent}%)
            </span>
          </div>
          <div className="flex space-x-2 text-[11px]">
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-semibold">
              {roster.filter((i) => i.attendance_record?.status === "present").length} Present
            </span>
            <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded font-semibold">
              {roster.filter((i) => i.attendance_record?.status === "absent").length} Absent
            </span>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded font-semibold">
              {roster.filter((i) => i.attendance_record?.status === "late").length} Late
            </span>
            <span className="px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 rounded font-semibold">
              {roster.filter((i) => i.attendance_record?.status === "excused").length} Excused
            </span>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-300 rounded font-medium">
              {unmarkedCount} Unmarked
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participant name or email..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="font-medium text-slate-700">Course Filter:</span>
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
          >
            <option value="all">All Courses / Program Roster ({roster.length})</option>
            {courses.map((c) => {
              const isAssigned = facilitatorAssignedCourses.includes(c.id);
              return (
                <option key={c.id} value={c.id}>
                  {c.name} {isAssigned ? " (Your Assigned Focus)" : ""}
                </option>
              );
            })}
            <option value="unassigned">Unassigned Course Only</option>
          </select>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {filteredRoster.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No participants match the selected course filter or search query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Participant Name</th>
                  <th className="py-2.5 px-4">Contact Details</th>
                  <th className="py-2.5 px-4">Course / Track</th>
                  <th className="py-2.5 px-4">Current Status</th>
                  <th className="py-2.5 px-4 text-right">Quick Mark Attendance Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRoster.map((item) => {
                  const rec = item.attendance_record;
                  const isSaving = savingId === item.enrollment_id;

                  return (
                    <tr
                      key={item.enrollment_id}
                      className={`hover:bg-slate-50 transition ${
                        !rec ? "bg-slate-50/40" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {item.participant.full_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>{item.participant.email || "—"}</div>
                        <div className="text-[11px] text-slate-400">{item.participant.phone || ""}</div>
                      </td>
                      <td className="py-3 px-4">
                        {item.course?.name ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-medium text-[11px]">
                            <BookOpen className="w-3 h-3 mr-1 text-teal-600" />
                            {item.course.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {!rec ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-medium border border-dashed border-slate-300 bg-slate-50 text-slate-500">
                            Unmarked
                          </span>
                        ) : rec.status === "present" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                            Present
                          </span>
                        ) : rec.status === "absent" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5 text-rose-600 mr-1" />
                            Absent
                          </span>
                        ) : rec.status === "late" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600 mr-1" />
                            Late
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                            Excused
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {session.is_active ? (
                          <div className="inline-flex items-center space-x-1">
                            <button
                              disabled={isSaving}
                              onClick={() => handleMarkStatus(item.enrollment_id, "present")}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition border ${
                                rec?.status === "present"
                                  ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                              }`}
                            >
                              Present
                            </button>
                            <button
                              disabled={isSaving}
                              onClick={() => handleMarkStatus(item.enrollment_id, "absent")}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition border ${
                                rec?.status === "absent"
                                  ? "bg-rose-700 text-white border-rose-700 shadow-xs"
                                  : "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200"
                              }`}
                            >
                              Absent
                            </button>
                            <button
                              disabled={isSaving}
                              onClick={() => handleMarkStatus(item.enrollment_id, "late")}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition border ${
                                rec?.status === "late"
                                  ? "bg-amber-700 text-white border-amber-700 shadow-xs"
                                  : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
                              }`}
                            >
                              Late
                            </button>
                            <button
                              disabled={isSaving}
                              onClick={() => handleMarkStatus(item.enrollment_id, "excused")}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition border ${
                                rec?.status === "excused"
                                  ? "bg-sky-700 text-white border-sky-700 shadow-xs"
                                  : "bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200"
                              }`}
                            >
                              Excused
                            </button>
                          </div>
                        ) : (
                          <span
                            className="text-[11px] text-slate-400 italic"
                            title="Session is inactive — attendance is read-only"
                          >
                            Read-only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MARK ALL PRESENT MODAL */}
      <Modal
        isOpen={isMarkAllOpen}
        onClose={() => setIsMarkAllOpen(false)}
        title="Mark Unmarked Participants as Present"
        maxWidth="xl"
      >
        <form onSubmit={handleMarkAllPresentSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-teal-50 border border-teal-200 text-teal-800 rounded-md text-[11px]">
            <span className="font-bold">Safe Bulk Operation:</span> This action will mark all currently <span className="font-semibold">unmarked</span> participants in this session as <span className="font-semibold text-emerald-800">Present</span>. Pre-marked attendance records will NOT be overwritten.
          </div>

          <div>
            <h4 className="font-semibold text-slate-700 mb-1.5">Specify Exceptions (Optional):</h4>
            <p className="text-slate-500 text-[11px] mb-2">
              Select any participant below to set a specific status (Absent, Late, Excused) or exclude them from being marked present.
            </p>

            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100 p-2">
              {roster
                .filter((item) => !item.attendance_record) // Only unmarked participants
                .map((item) => {
                  const currentException = markAllExceptions[item.enrollment_id] || "";
                  return (
                    <div key={item.enrollment_id} className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-50">
                      <div>
                        <span className="font-semibold text-slate-900">{item.participant.full_name}</span>
                        {item.course?.name && (
                          <span className="ml-2 text-[10px] text-slate-500">({item.course.name})</span>
                        )}
                      </div>
                      <select
                        value={currentException}
                        onChange={(e) =>
                          setMarkAllExceptions((prev) => ({
                            ...prev,
                            [item.enrollment_id]: e.target.value as "absent" | "late" | "excused" | "exclude",
                          }))
                        }
                        className="px-2 py-1 border border-slate-300 rounded text-xs bg-white focus:outline-none"
                      >
                        <option value="">Default (Mark Present)</option>
                        <option value="absent">Mark Absent</option>
                        <option value="late">Mark Late</option>
                        <option value="excused">Mark Excused</option>
                        <option value="exclude">Exclude / Keep Unmarked</option>
                      </select>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsMarkAllOpen(false)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={markAllLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {markAllLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm & Mark Present</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
