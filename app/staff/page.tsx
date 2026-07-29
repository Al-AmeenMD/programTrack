"use client";

import React, { useEffect, useState } from "react";
import {
  UserPlus,
  RefreshCw,
  AlertCircle,
  KeyRound,
  Edit3,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Plus,
  Trash2,
  UserX,
  UserCheck,
  BookOpen,
} from "lucide-react";
import { Modal, ConfirmDialog } from "@/components/ui/Dialog";
import { useAuth } from "@/components/AuthProvider";

type Course = {
  id: string;
  name: string;
};

type Program = {
  id: string;
  name: string;
  courses?: Course[];
};

type FacilitatorCourseAssignment = {
  id: string;
  course_id: string;
  course: Course;
};

type ProgramStaffAssignment = {
  id: string;
  program_id: string;
  program: Program;
  courses?: FacilitatorCourseAssignment[];
};

type StaffAccount = {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "facilitator";
  status: "active" | "inactive";
  created_at: string;
  program_staff?: ProgramStaffAssignment[];
};

export default function StaffManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";

  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Staff Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "facilitator" as "admin" | "facilitator",
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Staff Modal State
  const [editTarget, setEditTarget] = useState<StaffAccount | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    role: "facilitator" as "admin" | "facilitator",
    status: "active" as "active" | "inactive",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Deactivate Staff Confirmation Modal State
  const [deactivateTarget, setDeactivateTarget] = useState<StaffAccount | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  // Admin Password Reset Modal State
  const [resetTarget, setResetTarget] = useState<StaffAccount | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Manage Programs Modal State
  const [assignTarget, setAssignTarget] = useState<StaffAccount | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [programCoursesMap, setProgramCoursesMap] = useState<Record<string, Course[]>>({});

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/staff");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load staff list");
      setStaffList(json.data || []);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to load staff list");
    }
  };

  const fetchPrograms = async () => {
    try {
      const res = await fetch("/api/programs?pageSize=100");
      const json = await res.json();
      if (res.ok) setPrograms(json.data || []);
    } catch {
      // Ignore
    }
  };

  const fetchCoursesForProgram = async (programId: string) => {
    if (programCoursesMap[programId]) return;
    try {
      const res = await fetch(`/api/programs/${programId}/courses`);
      const json = await res.json();
      if (res.ok) {
        setProgramCoursesMap((prev) => ({
          ...prev,
          [programId]: json.data || [],
        }));
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (isAdmin) {
      const init = async () => {
        setLoading(true);
        setError(null);
        await Promise.all([fetchStaff(), fetchPrograms()]);
        setLoading(false);
      };
      init();
    }
  }, [isAdmin]);

  // When assign target changes, fetch courses for assigned programs
  useEffect(() => {
    if (assignTarget?.program_staff) {
      assignTarget.program_staff.forEach((ps) => {
        fetchCoursesForProgram(ps.program_id);
      });
    }
  }, [assignTarget]);

  if (authLoading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
        <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
        <span>Verifying staff access permissions...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-12 text-center text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-md">
        <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-2" />
        <span className="font-bold text-sm block mb-1">Access Denied</span>
        <span>Staff account management is restricted to Admin users only.</span>
      </div>
    );
  }

  const refreshAssignTarget = async (targetId: string) => {
    const updatedList = await (await fetch("/api/staff")).json();
    const updatedStaff = updatedList.data || [];
    setStaffList(updatedStaff);
    const updatedUser = updatedStaff.find((s: StaffAccount) => s.id === targetId);
    if (updatedUser) setAssignTarget(updatedUser);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create staff account");

      setIsAddOpen(false);
      setAddForm({ full_name: "", email: "", password: "", role: "facilitator" });
      await fetchStaff();
    } catch (err: unknown) {
      setAddError((err as { message?: string }).message || "Failed to create staff account");
    } finally {
      setAddLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/staff/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update staff account");

      setEditTarget(null);
      await fetchStaff();
    } catch (err: unknown) {
      setEditError((err as { message?: string }).message || "Failed to update staff account");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return;
    setDeactivateLoading(true);

    try {
      const isDeactivating = deactivateTarget.status === "active";
      const res = await fetch(`/api/staff/${deactivateTarget.id}`, {
        method: isDeactivating ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        ...(isDeactivating ? {} : { body: JSON.stringify({ status: "active" }) }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update account status");
      }

      const selfDeactivated = isDeactivating && deactivateTarget.id === user?.id;
      setDeactivateTarget(null);

      if (selfDeactivated) {
        window.location.href = "/api/auth/logout";
        return;
      }

      await fetchStaff();
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to update account status");
    } finally {
      setDeactivateLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (!resetPasswordInput || resetPasswordInput.length < 6) {
      setResetError("New password must be at least 6 characters");
      return;
    }

    setResetLoading(true);
    setResetError(null);
    setResetSuccessMsg(null);

    try {
      const res = await fetch(`/api/staff/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPasswordInput }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to reset password");

      setResetSuccessMsg(`Password successfully reset for ${resetTarget.full_name}!`);
      setTimeout(() => {
        setResetTarget(null);
        setResetPasswordInput("");
        setResetSuccessMsg(null);
      }, 1500);
    } catch (err: unknown) {
      setResetError((err as { message?: string }).message || "Failed to reset password");
    } finally {
      setResetLoading(false);
    }
  };

  const handleAssignProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTarget || !selectedProgramId) return;

    setAssignLoading(true);
    setAssignError(null);

    try {
      const res = await fetch(`/api/staff/${assignTarget.id}/programs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program_id: selectedProgramId }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to assign program");

      setSelectedProgramId("");
      await refreshAssignTarget(assignTarget.id);
    } catch (err: unknown) {
      setAssignError((err as { message?: string }).message || "Failed to assign program");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleUnassignProgram = async (programId: string) => {
    if (!assignTarget) return;

    setAssignLoading(true);
    setAssignError(null);

    try {
      const res = await fetch(`/api/staff/${assignTarget.id}/programs?program_id=${programId}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to unassign program");

      await refreshAssignTarget(assignTarget.id);
    } catch (err: unknown) {
      setAssignError((err as { message?: string }).message || "Failed to unassign program");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAssignCourse = async (programId: string, courseId: string) => {
    if (!assignTarget) return;

    setAssignLoading(true);
    setAssignError(null);

    try {
      const res = await fetch(`/api/staff/${assignTarget.id}/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program_id: programId, course_id: courseId }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to assign course");

      await refreshAssignTarget(assignTarget.id);
    } catch (err: unknown) {
      setAssignError((err as { message?: string }).message || "Failed to assign course");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleUnassignCourse = async (programId: string, courseId: string) => {
    if (!assignTarget) return;

    setAssignLoading(true);
    setAssignError(null);

    try {
      const res = await fetch(
        `/api/staff/${assignTarget.id}/courses?program_id=${programId}&course_id=${courseId}`,
        { method: "DELETE" }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to unassign course");

      await refreshAssignTarget(assignTarget.id);
    } catch (err: unknown) {
      setAssignError((err as { message?: string }).message || "Failed to unassign course");
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-teal-700" />
            <span>Staff Account Management</span>
          </h1>
          <p className="text-xs text-slate-500">
            Create staff accounts, assign program and course access to facilitators, and manage staff credentials
          </p>
        </div>

        <button
          onClick={() => {
            setIsAddOpen(true);
            setAddError(null);
          }}
          className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs rounded-md shadow-xs transition flex items-center justify-center space-x-1.5 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Account</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Staff Accounts Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
            <span>Loading staff accounts...</span>
          </div>
        ) : staffList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No staff accounts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Full Name</th>
                  <th className="py-2.5 px-4">Email</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Assigned Programs / Courses</th>
                  <th className="py-2.5 px-4">Created Date</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.map((s) => {
                  const assignedList = s.program_staff || [];
                  const isInactive = s.status === "inactive";
                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-50 transition ${isInactive ? "bg-slate-50/70 text-slate-400" : ""}`}
                    >
                      <td className="py-2.5 px-4 font-bold text-slate-900 flex items-center space-x-1.5">
                        <span>{s.full_name}</span>
                        {isInactive && (
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-normal">
                            Deactivated
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">{s.email}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                            s.role === "admin"
                              ? "bg-slate-700 text-slate-100"
                              : "bg-teal-100 text-teal-800"
                          }`}
                        >
                          {s.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isInactive
                              ? "bg-rose-100 text-rose-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {s.status || "active"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {s.role === "admin" ? (
                          <span className="text-slate-400 italic">All Programs (Admin)</span>
                        ) : assignedList.length === 0 ? (
                          <span className="text-amber-700 italic font-medium">None assigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {assignedList.map((ps) => {
                              const assignedCourses = ps.courses || [];
                              return (
                                <div
                                  key={ps.id}
                                  className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium text-[11px] space-y-0.5"
                                >
                                  <div>{ps.program.name}</div>
                                  {assignedCourses.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-0.5">
                                      {assignedCourses.map((c) => (
                                        <span
                                          key={c.id}
                                          className="px-1.5 py-0.2 bg-teal-50 text-teal-800 border border-teal-200 rounded text-[10px]"
                                        >
                                          {c.course.name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-1.5">
                        {s.role === "facilitator" && s.status === "active" && (
                          <button
                            onClick={() => {
                              setAssignTarget(s);
                              setAssignError(null);
                              setSelectedProgramId("");
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition inline-flex items-center space-x-1"
                            title="Assign Program & Course Access"
                          >
                            <Layers className="w-3 h-3 text-teal-700" />
                            <span>Programs/Courses</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditTarget(s);
                            setEditForm({ full_name: s.full_name, role: s.role, status: s.status });
                            setEditError(null);
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition inline-flex items-center space-x-1"
                          title="Edit Staff Account"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => {
                            setResetTarget(s);
                            setResetPasswordInput("");
                            setResetError(null);
                            setResetSuccessMsg(null);
                          }}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-medium transition inline-flex items-center space-x-1"
                          title="Admin Reset Password"
                        >
                          <KeyRound className="w-3 h-3 text-amber-700" />
                          <span>Reset Pass</span>
                        </button>
                        <button
                          onClick={() => setDeactivateTarget(s)}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition inline-flex items-center space-x-1 border ${
                            s.status === "active"
                              ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                          }`}
                          title={s.status === "active" ? "Deactivate Account" : "Reactivate Account"}
                        >
                          {s.status === "active" ? (
                            <>
                              <UserX className="w-3 h-3" />
                              <span>Deactivate</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3" />
                              <span>Reactivate</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD STAFF MODAL */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add New Staff Account">
        <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
          {addError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-md flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <div>
            <label className="block font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={addForm.full_name}
              onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
              placeholder="e.g. Ibrahim Abubakar"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              placeholder="ibrahim@developmenthub.org"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Initial Password (min 6 chars)</label>
            <input
              type="password"
              required
              minLength={6}
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              placeholder="••••••••"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Account Role</label>
            <select
              value={addForm.role}
              onChange={(e) =>
                setAddForm({ ...addForm, role: e.target.value as "admin" | "facilitator" })
              }
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="facilitator">Facilitator (Scoped program access)</option>
              <option value="admin">Admin (Full system access)</option>
            </select>
          </div>

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
              <span>Create Account</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT STAFF MODAL */}
      <Modal isOpen={Boolean(editTarget)} onClose={() => setEditTarget(null)} title="Edit Staff Details">
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          {editError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-md flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div>
            <label className="block font-medium text-slate-700 mb-1">Email (Read-only)</label>
            <input
              type="text"
              disabled
              value={editTarget?.email || ""}
              className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100 text-slate-500 rounded-md text-xs"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={editForm.full_name}
              onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Role</label>
              <select
                value={editForm.role}
                onChange={(e) =>
                  setEditForm({ ...editForm, role: e.target.value as "admin" | "facilitator" })
                }
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                <option value="facilitator">Facilitator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Account Status</label>
              <select
                value={editForm.status}
                onChange={(e) =>
                  setEditForm({ ...editForm, status: e.target.value as "active" | "inactive" })
                }
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive / Deactivated</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditTarget(null)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {editLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* DEACTIVATE STAFF CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivateConfirm}
        title={deactivateTarget?.status === "active" ? "Deactivate Staff Account" : "Reactivate Staff Account"}
        description={
          deactivateTarget?.status === "active"
            ? `Are you sure you want to deactivate "${deactivateTarget?.full_name}"? They will be immediately blocked from logging in. Historical records referencing this account will be preserved.`
            : `Reactivate staff account for "${deactivateTarget?.full_name}"?`
        }
        isLoading={deactivateLoading}
      />

      {/* ADMIN RESET PASSWORD MODAL */}
      <Modal
        isOpen={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={`Admin Password Reset — ${resetTarget?.full_name}`}
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-[11px]">
            <span className="font-bold">Admin Escape Hatch:</span> As an administrator, you are resetting this staff member&apos;s password without requiring their current password.
          </div>

          {resetError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-md flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{resetError}</span>
            </div>
          )}

          {resetSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{resetSuccessMsg}</span>
            </div>
          )}

          <div>
            <label className="block font-medium text-slate-700 mb-1">Set New Password (min 6 chars)</label>
            <input
              type="password"
              required
              minLength={6}
              value={resetPasswordInput}
              onChange={(e) => setResetPasswordInput(e.target.value)}
              placeholder="Enter new password..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setResetTarget(null)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-amber-700 hover:bg-amber-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {resetLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Password Reset</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MANAGE PROGRAM & COURSE ASSIGNMENTS MODAL */}
      <Modal
        isOpen={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        title={`Program & Course Assignments — ${assignTarget?.full_name}`}
        maxWidth="xl"
      >
        <div className="space-y-4 text-xs">
          {assignError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-md flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{assignError}</span>
            </div>
          )}

          <p className="text-slate-500 text-[11px]">
            Facilitators have full program-wide access to all participants in assigned programs. Course assignments serve as a primary focus labeling and pre-filter helper.
          </p>

          {/* Currently Assigned Programs */}
          <div>
            <h4 className="font-semibold text-slate-700 mb-2">Assigned Programs & Courses:</h4>
            {(!assignTarget?.program_staff || assignTarget.program_staff.length === 0) ? (
              <p className="text-slate-400 italic bg-slate-50 p-3 rounded border border-slate-200">
                No programs assigned yet. This facilitator currently cannot see any programs.
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto border border-slate-200 rounded p-2.5">
                {assignTarget.program_staff.map((ps) => {
                  const availableCourses = programCoursesMap[ps.program_id] || [];
                  const assignedCourseIds = (ps.courses || []).map((c) => c.course_id);

                  return (
                    <div
                      key={ps.id}
                      className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">{ps.program.name}</span>
                        <button
                          onClick={() => handleUnassignProgram(ps.program_id)}
                          disabled={assignLoading}
                          className="text-rose-600 hover:text-rose-800 text-[11px] font-medium flex items-center space-x-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Unassign Program</span>
                        </button>
                      </div>

                      {/* Course Assignment Sub-section */}
                      <div className="pl-3 border-l-2 border-teal-600 space-y-1.5 pt-1">
                        <span className="text-[11px] font-medium text-slate-600 flex items-center space-x-1">
                          <BookOpen className="w-3 h-3 text-teal-700" />
                          <span>Primary Course Assignments (Optional):</span>
                        </span>

                        {availableCourses.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">
                            No courses defined for this program. Access applies to program.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap gap-1.5">
                              {availableCourses.map((c) => {
                                const isAssigned = assignedCourseIds.includes(c.id);
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() =>
                                      isAssigned
                                        ? handleUnassignCourse(ps.program_id, c.id)
                                        : handleAssignCourse(ps.program_id, c.id)
                                    }
                                    disabled={assignLoading}
                                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition flex items-center space-x-1 border ${
                                      isAssigned
                                        ? "bg-teal-100 text-teal-800 border-teal-300 hover:bg-teal-200"
                                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                                    }`}
                                  >
                                    <span>{isAssigned ? "✓ " + c.name : "+ " + c.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add New Program Assignment */}
          <form onSubmit={handleAssignProgram} className="space-y-3 pt-3 border-t border-slate-100">
            <h4 className="font-semibold text-slate-700">Assign Additional Program:</h4>
            <div className="flex space-x-2">
              <select
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                <option value="">Select a Program to Assign</option>
                {programs
                  .filter(
                    (p) =>
                      !assignTarget?.program_staff?.some((ps) => ps.program_id === p.id)
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <button
                type="submit"
                disabled={!selectedProgramId || assignLoading}
                className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-md transition disabled:opacity-50 flex items-center space-x-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Assign</span>
              </button>
            </div>
          </form>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAssignTarget(null)}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
