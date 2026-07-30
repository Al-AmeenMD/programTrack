"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search, UserPlus, Trash2, Eye, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Filter, X, RotateCcw } from "lucide-react";
import { Modal, ConfirmDialog } from "@/components/ui/Dialog";
import { useAuth } from "@/components/AuthProvider";

type Participant = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  nin_number: string;
  qualification: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  status: string;
  enrollment_count?: number;
  _count?: {
    enrollments: number;
  };
};

type ProgramOption = {
  id: string;
  name: string;
};

export default function ParticipantsPage() {
  const { user } = useAuth();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [total, setTotal] = useState(0);

  // Add Participant Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    nin_number: "",
    qualification: "",
    email: "",
    phone: "",
    gender: "",
    date_of_birth: "",
    program_id: "",
    course_id: "",
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Available options for drop-downs
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [modalCourses, setModalCourses] = useState<{ id: string; name: string }[]>([]);
  const [modalCoursesLoading, setModalCoursesLoading] = useState(false);

  // Soft Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<Participant | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchParticipants = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(programFilter ? { program_id: programFilter } : {}),
        ...(courseFilter ? { course_id: courseFilter } : {}),
        ...(genderFilter && genderFilter !== "all" ? { gender: genderFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });

      const res = await fetch(`/api/participants?${query.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load participants");
      }

      setParticipants(json.data || []);
      setTotal(json.meta?.total || 0);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to load participants");
    } finally {
      setLoading(false);
    }
  };

  const fetchPrograms = async () => {
    try {
      const res = await fetch("/api/programs?pageSize=100");
      const json = await res.json();
      if (res.ok) {
        setPrograms((json.data || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchParticipants();
  }, [page, search, programFilter, courseFilter, genderFilter, statusFilter]);

  useEffect(() => {
    fetchPrograms();
  }, []);

  useEffect(() => {
    setCourseFilter("");
    if (!programFilter) {
      setCourses([]);
      return;
    }

    const fetchCourses = async () => {
      setCoursesLoading(true);
      try {
        const res = await fetch(`/api/programs/${programFilter}/courses`);
        const json = await res.json();
        if (res.ok) {
          setCourses(json.data || []);
        }
      } catch {
        setCourses([]);
      } finally {
        setCoursesLoading(false);
      }
    };

    fetchCourses();
  }, [programFilter]);

  useEffect(() => {
    setAddForm((prev) => ({ ...prev, course_id: "" }));
    if (!addForm.program_id) {
      setModalCourses([]);
      return;
    }

    const fetchModalCourses = async () => {
      setModalCoursesLoading(true);
      try {
        const res = await fetch(`/api/programs/${addForm.program_id}/courses`);
        const json = await res.json();
        if (res.ok) {
          setModalCourses(json.data || []);
        }
      } catch {
        setModalCourses([]);
      } finally {
        setModalCoursesLoading(false);
      }
    };

    fetchModalCourses();
  }, [addForm.program_id]);

  const handleResetFilters = () => {
    setSearch("");
    setProgramFilter("");
    setCourseFilter("");
    setGenderFilter("all");
    setStatusFilter("active");
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
      programFilter ||
      courseFilter ||
      (genderFilter && genderFilter !== "all") ||
      statusFilter !== "active"
  );

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.email && !addForm.phone) {
      setAddError("At least one of email or phone is required");
      return;
    }

    if (addForm.nin_number && !/^\d{11}$/.test(addForm.nin_number.trim())) {
      setAddError("NIN number must be exactly 11 numeric digits");
      return;
    }

    setAddLoading(true);
    setAddError(null);

    try {
      const res = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: addForm.first_name,
          middle_name: addForm.middle_name || null,
          last_name: addForm.last_name,
          nin_number: addForm.nin_number,
          qualification: addForm.qualification || null,
          email: addForm.email || null,
          phone: addForm.phone || null,
          gender: addForm.gender || null,
          date_of_birth: addForm.date_of_birth || null,
          ...(addForm.program_id ? { program_id: addForm.program_id } : {}),
          ...(addForm.course_id ? { course_id: addForm.course_id } : {}),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create participant");
      }

      setIsAddOpen(false);
      setAddForm({
        first_name: "",
        middle_name: "",
        last_name: "",
        nin_number: "",
        qualification: "",
        email: "",
        phone: "",
        gender: "",
        date_of_birth: "",
        program_id: "",
        course_id: "",
      });
      fetchParticipants();
    } catch (err: unknown) {
      setAddError((err as { message?: string }).message || "Failed to create participant");
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    try {
      const res = await fetch(`/api/participants/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to delete participant");
      }

      setDeleteTarget(null);
      fetchParticipants();
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to delete participant");
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Participants</h1>
          <p className="text-xs text-slate-500">
            Manage participant directory, contact details, and program enrollments
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs rounded-md shadow-xs transition flex items-center justify-center space-x-1.5 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Participant</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Text Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, email, or phone number..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 transition"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md transition flex items-center space-x-1.5 self-start md:self-auto shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs pt-1 border-t border-slate-100">
          {/* Program Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Program Filter
            </label>
            <select
              value={programFilter}
              onChange={(e) => {
                setProgramFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="">All Programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Course Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Course / Track
            </label>
            <select
              value={courseFilter}
              disabled={!programFilter || coursesLoading}
              onChange={(e) => {
                setCourseFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">
                {!programFilter
                  ? "Select Program First"
                  : coursesLoading
                  ? "Loading Courses..."
                  : "All Courses"}
              </option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Gender Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Gender</label>
            <select
              value={genderFilter}
              onChange={(e) => {
                setGenderFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="all">All Genders</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="unspecified">Unspecified</option>
            </select>
          </div>

          {/* Participant Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="active">Active Only</option>
              <option value="inactive">Inactive (Soft Deleted)</option>
              <option value="all">All Statuses</option>
            </select>
          </div>
        </div>

        {/* Active Filter Badges */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-1">
            <span className="text-slate-400 font-medium mr-1 flex items-center space-x-1">
              <Filter className="w-3 h-3" />
              <span>Active Filters:</span>
            </span>

            {programFilter && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                <span>Prog: {programs.find((p) => p.id === programFilter)?.name || "Selected"}</span>
                <button
                  onClick={() => setProgramFilter("")}
                  className="hover:text-teal-950 font-bold"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {courseFilter && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                <span>Course: {courses.find((c) => c.id === courseFilter)?.name || "Selected"}</span>
                <button
                  onClick={() => setCourseFilter("")}
                  className="hover:text-teal-950 font-bold"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {genderFilter && genderFilter !== "all" && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 capitalize">
                <span>Gender: {genderFilter}</span>
                <button
                  onClick={() => setGenderFilter("all")}
                  className="hover:text-slate-950 font-bold"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {statusFilter !== "active" && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 capitalize">
                <span>Status: {statusFilter}</span>
                <button
                  onClick={() => setStatusFilter("active")}
                  className="hover:text-slate-950 font-bold"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {search.trim() && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                <span>Search: &quot;{search}&quot;</span>
                <button onClick={() => setSearch("")} className="hover:text-sky-950 font-bold">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
            <span>Loading participants directory...</span>
          </div>
        ) : participants.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No participants found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Participant Name</th>
                  <th className="py-2.5 px-4">NIN Number</th>
                  <th className="py-2.5 px-4">Qualification</th>
                  <th className="py-2.5 px-4">Email</th>
                  <th className="py-2.5 px-4">Phone</th>
                  <th className="py-2.5 px-4">Gender</th>
                  <th className="py-2.5 px-4">Date of Birth</th>
                  <th className="py-2.5 px-4">Enrollments</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participants.map((p) => {
                  const displayName = p.full_name || [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        <Link
                          href={`/participants/${p.id}`}
                          className="hover:text-teal-700 hover:underline"
                        >
                          {displayName}
                        </Link>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${p.nin_number === 'NIN-PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'}`}>
                          {p.nin_number || "—"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{p.qualification || "—"}</td>
                      <td className="py-2.5 px-4 text-slate-600">{p.email || "—"}</td>
                      <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">{p.phone || "—"}</td>
                      <td className="py-2.5 px-4 text-slate-600 capitalize">{p.gender || "—"}</td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {p.enrollment_count ?? p._count?.enrollments ?? 0} program(s)
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-2">
                        <Link
                          href={`/participants/${p.id}`}
                          className="p-1 text-slate-500 hover:text-teal-700 inline-block"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="p-1 text-slate-400 hover:text-rose-600 inline-block"
                          title="Delete Participant"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && participants.length > 0 && (
          <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing page <span className="font-semibold text-slate-900">{page}</span> of{" "}
              <span className="font-semibold text-slate-900">{totalPages}</span> ({total} total records)
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

      {/* Add Participant Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add New Participant">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {addError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={addForm.first_name}
                onChange={(e) => setAddForm({ ...addForm, first_name: e.target.value })}
                placeholder="Amina"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Middle Name (Opt)
              </label>
              <input
                type="text"
                value={addForm.middle_name}
                onChange={(e) => setAddForm({ ...addForm, middle_name: e.target.value })}
                placeholder="Bello"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Surname / Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={addForm.last_name}
                onChange={(e) => setAddForm({ ...addForm, last_name: e.target.value })}
                placeholder="Yusuf"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                NIN Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={addForm.nin_number}
                onChange={(e) => setAddForm({ ...addForm, nin_number: e.target.value })}
                placeholder="e.g. 12345678901"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Qualification (Optional)
              </label>
              <input
                type="text"
                value={addForm.qualification}
                onChange={(e) => setAddForm({ ...addForm, qualification: e.target.value })}
                placeholder="e.g. B.Sc Computer Science"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                placeholder="fatima@example.com"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                placeholder="+234..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
              <select
                value={addForm.gender}
                onChange={(e) => setAddForm({ ...addForm, gender: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                <option value="">Select Gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date of Birth</label>
              <input
                type="date"
                value={addForm.date_of_birth}
                onChange={(e) => setAddForm({ ...addForm, date_of_birth: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Enroll into Program (Optional)
            </label>
            <select
              value={addForm.program_id}
              onChange={(e) => setAddForm({ ...addForm, program_id: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="">Do not enroll into a program now</option>
              {programs.map((prog) => (
                <option key={prog.id} value={prog.id}>
                  {prog.name}
                </option>
              ))}
            </select>
          </div>

          {Boolean(addForm.program_id && (modalCoursesLoading || modalCourses.length > 0)) && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Select Course / Track (Optional)
              </label>
              {modalCoursesLoading ? (
                <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 py-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-teal-700" />
                  <span>Loading courses for program...</span>
                </div>
              ) : (
                <select
                  value={addForm.course_id}
                  onChange={(e) => setAddForm({ ...addForm, course_id: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 bg-teal-50/40"
                >
                  <option value="">Unassigned (No course/track selected)</option>
                  {modalCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {addLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Participant</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Participant"
        description={`Are you sure you want to delete participant "${deleteTarget?.full_name}"? This will soft-delete their participant profile.`}
        isLoading={deleteLoading}
      />
    </div>
  );
}
