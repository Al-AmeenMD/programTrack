"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Search,
  RefreshCw,
  AlertCircle,
  Calendar,
  Users,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Modal, ConfirmDialog } from "@/components/ui/Dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/components/AuthProvider";

type ProgramInfo = {
  id: string;
  name: string;
  status: string;
};

type CourseDetail = {
  id: string;
  program_id: string;
  name: string;
  created_at: string;
  program: ProgramInfo;
  _count?: {
    enrollments: number;
  };
};

type Participant = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
};

type Enrollment = {
  id: string;
  participant_id: string;
  program_id: string;
  course_id: string | null;
  status: string;
  enrolled_at: string;
  participant: Participant;
  program?: ProgramInfo;
  course?: { id: string; name: string } | null;
};

type RouteContext = {
  params: Promise<{
    id: string;
    courseId: string;
  }>;
};

export default function CourseDetailPage({ params }: RouteContext) {
  const { id: programId, courseId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Pagination
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [total, setTotal] = useState(0);

  // Update Enrollment Status State
  const [updateEnrollmentTarget, setUpdateEnrollmentTarget] = useState<Enrollment | null>(null);
  const [newStatus, setNewStatus] = useState("registered");
  const [updateStatusLoading, setUpdateStatusLoading] = useState(false);

  // Change Course Modal State
  const [programCourses, setProgramCourses] = useState<{ id: string; name: string }[]>([]);
  const [changeCourseTarget, setChangeCourseTarget] = useState<Enrollment | null>(null);
  const [changeCourseSelectedId, setChangeCourseSelectedId] = useState("");
  const [changeCourseLoading, setChangeCourseLoading] = useState(false);

  // Drop Enrollment Confirmation State
  const [dropTarget, setDropTarget] = useState<Enrollment | null>(null);
  const [dropLoading, setDropLoading] = useState(false);

  const fetchProgramCourses = async () => {
    try {
      const res = await fetch(`/api/programs/${programId}/courses`);
      const json = await res.json();
      if (res.ok) setProgramCourses(json.data || []);
    } catch {
      // Ignore
    }
  };

  const handleChangeCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeCourseTarget) return;

    setChangeCourseLoading(true);
    try {
      const res = await fetch(`/api/enrollments/${changeCourseTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: changeCourseSelectedId || null }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update enrollment course");
      }

      setChangeCourseTarget(null);
      await fetchEnrollments(true);
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to update course");
    } finally {
      setChangeCourseLoading(false);
    }
  };

  const fetchCourseData = async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load course details");
      setCourse(json.data);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to load course details");
    }
  };

  const fetchEnrollments = async (silent = false) => {
    if (!silent) setEnrollmentsLoading(true);
    try {
      const query = new URLSearchParams({
        course_id: courseId,
        page: page.toString(),
        pageSize: pageSize.toString(),
        status: statusFilter,
        ...(search.trim() ? { search: search.trim() } : {}),
      });

      const res = await fetch(`/api/programs/${programId}/enrollments?${query.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load course enrollments");

      setEnrollments(json.data || []);
      setTotal(json.meta?.total || 0);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to load course enrollments");
    } finally {
      if (!silent) setEnrollmentsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);
      await Promise.all([fetchCourseData(), fetchProgramCourses()]);
      await fetchEnrollments(true);
      setLoading(false);
    };
    init();
  }, [programId, courseId]);

  useEffect(() => {
    if (!loading) {
      fetchEnrollments();
    }
  }, [page, search, statusFilter]);

  const handleUpdateStatusConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateEnrollmentTarget) return;

    setUpdateStatusLoading(true);
    try {
      const res = await fetch(`/api/enrollments/${updateEnrollmentTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update enrollment status");

      setUpdateEnrollmentTarget(null);
      await fetchCourseData();
      await fetchEnrollments(true);
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to update enrollment status");
    } finally {
      setUpdateStatusLoading(false);
    }
  };

  const handleDropEnrollmentConfirm = async () => {
    if (!dropTarget) return;

    setDropLoading(true);
    try {
      const res = await fetch(`/api/enrollments/${dropTarget.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to drop enrollment");
      }

      setDropTarget(null);
      await fetchCourseData();
      await fetchEnrollments(true);
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to drop enrollment");
    } finally {
      setDropLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
        <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
        <span>Loading course details...</span>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="space-y-4">
        <Link
          href={`/programs/${programId}`}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Program</span>
        </Link>
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error || "Course not found"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Header */}
      <div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 mb-3">
          <Link href="/programs" className="hover:text-slate-900">
            Programs
          </Link>
          <span>/</span>
          <Link href={`/programs/${programId}`} className="hover:text-slate-900 font-medium">
            {course.program?.name || "Program"}
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-semibold">{course.name}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{course.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 flex items-center space-x-1">
                <BookOpen className="w-3 h-3" />
                <span>Course Track</span>
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Belongs to program:{" "}
              <Link
                href={`/programs/${programId}`}
                className="text-teal-700 hover:underline font-medium"
              >
                {course.program?.name}
              </Link>
            </p>
          </div>

          <Link
            href={`/programs/${programId}`}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md transition flex items-center space-x-1.5 self-start sm:self-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Program Overview</span>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center gap-8 text-xs">
        <div>
          <span className="text-slate-400 font-medium block text-[11px]">Enrolled Participants</span>
          <span className="text-sm font-bold text-slate-900 flex items-center space-x-1 mt-0.5">
            <Users className="w-4 h-4 text-teal-700" />
            <span>{course._count?.enrollments ?? total}</span>
          </span>
        </div>
        <div className="border-l border-slate-200 pl-8">
          <span className="text-slate-400 font-medium block text-[11px]">Program Status</span>
          <div className="mt-0.5">
            <StatusBadge status={course.program?.status || "active"} />
          </div>
        </div>
        <div className="border-l border-slate-200 pl-8">
          <span className="text-slate-400 font-medium block text-[11px]">Created Date</span>
          <span className="font-medium text-slate-900 flex items-center space-x-1 mt-0.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{new Date(course.created_at).toLocaleDateString()}</span>
          </span>
        </div>
      </div>

      {/* Course Enrolled Participants Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Enrolled Participants in {course.name}</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 text-xs font-normal">
              {total} total
            </span>
          </h2>

          <div className="flex items-center space-x-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search participant..."
                className="pl-8 pr-3 py-1 border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            {/* Status Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="all">All Statuses (inc. Dropped)</option>
              <option value="registered">Registered</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          {enrollmentsLoading ? (
            <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
              <span>Loading course participants...</span>
            </div>
          ) : enrollments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No participants found enrolled in this course matching criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Participant Name</th>
                    <th className="py-2.5 px-4">Email</th>
                    <th className="py-2.5 px-4">Phone</th>
                    <th className="py-2.5 px-4">Enrollment Status</th>
                    <th className="py-2.5 px-4">Enrolled Date</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrollments.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        <Link
                          href={`/participants/${e.participant.id}`}
                          className="hover:text-teal-700 hover:underline"
                        >
                          {e.participant.full_name}
                        </Link>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{e.participant.email || "—"}</td>
                      <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">
                        {e.participant.phone || "—"}
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {new Date(e.enrolled_at).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-2">
                        {programCourses.length > 0 && (
                          <button
                            onClick={() => {
                              setChangeCourseTarget(e);
                              setChangeCourseSelectedId(e.course_id || "");
                            }}
                            className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded text-[11px] font-medium transition"
                            title="Reassign or Change Course"
                          >
                            Change Course
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setUpdateEnrollmentTarget(e);
                            setNewStatus(e.status);
                          }}
                          className="p-1 text-slate-500 hover:text-teal-700 inline-block"
                          title="Change Status"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {e.status !== "dropped" && (
                          <button
                            onClick={() => setDropTarget(e)}
                            className="p-1 text-slate-400 hover:text-rose-600 inline-block"
                            title="Drop Enrollment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {!enrollmentsLoading && enrollments.length > 0 && (
            <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div>
                Page <span className="font-semibold text-slate-900">{page}</span> of{" "}
                <span className="font-semibold text-slate-900">{totalPages}</span> ({total} total)
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={page <= 1}
                  className="px-2.5 py-1 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 transition flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <button
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={page >= totalPages}
                  className="px-2.5 py-1 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 transition flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Status Modal */}
      <Modal
        isOpen={Boolean(updateEnrollmentTarget)}
        onClose={() => setUpdateEnrollmentTarget(null)}
        title="Update Enrollment Status"
      >
        <form onSubmit={handleUpdateStatusConfirm} className="space-y-4">
          <p className="text-xs text-slate-600">
            Updating enrollment status for{" "}
            <span className="font-bold text-slate-900 font-medium">
              {updateEnrollmentTarget?.participant.full_name}
            </span>{" "}
            in course <span className="font-semibold text-teal-700">{course.name}</span>.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Select New Enrollment Status
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="registered">Registered</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setUpdateEnrollmentTarget(null)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateStatusLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {updateStatusLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Status</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Drop Enrollment Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(dropTarget)}
        onClose={() => setDropTarget(null)}
        onConfirm={handleDropEnrollmentConfirm}
        title="Drop Enrollment"
        description={`Are you sure you want to drop "${dropTarget?.participant.full_name}" from this course/program? Status will be updated to "dropped".`}
        isLoading={dropLoading}
        confirmLabel="Drop Enrollment"
      />

      {/* Change Course Modal */}
      <Modal
        isOpen={Boolean(changeCourseTarget)}
        onClose={() => setChangeCourseTarget(null)}
        title={`Change Course Assignment — ${changeCourseTarget?.participant.full_name}`}
      >
        <form onSubmit={handleChangeCourseSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Select Course / Track
            </label>
            <select
              value={changeCourseSelectedId}
              onChange={(e) => setChangeCourseSelectedId(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="">Unassigned (No course/track selected)</option>
              {programCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setChangeCourseTarget(null)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={changeCourseLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {changeCourseLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Assignment</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
