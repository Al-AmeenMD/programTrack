"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Calendar,
  FileText,
  Upload,
  UserPlus,
  Trash2,
  Edit,
  Ban,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal, ConfirmDialog } from "@/components/ui/Dialog";
import { BulkUploadModal } from "@/components/BulkUploadModal";
import { useAuth } from "@/components/AuthProvider";

type Enrollment = {
  id: string;
  participant_id: string;
  program_id: string;
  status: string;
  created_at: string;
  participant: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  };
};

type SessionItem = {
  id: string;
  title: string;
  session_date: string;
  is_active: boolean;
};

type FormFieldItem = {
  id?: string;
  label: string;
  field_type: string;
  required: boolean;
  options?: string[];
};

type FormTemplateData = {
  id: string;
  name: string;
  fields: FormFieldItem[];
};

type ProgramDetail = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export default function ProgramDetailPage({ params }: RouteContext) {
  const { id } = use(params);
  const router = useRouter();
  const { user, assignedProgramIds } = useAuth();

  const isAdmin = user?.role === "admin";
  const isAssigned = isAdmin || assignedProgramIds.includes(id);

  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [formTemplate, setFormTemplate] = useState<FormTemplateData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"enrollments" | "sessions" | "form-template">("enrollments");

  // Edit Program Modal
  const [isEditProgramOpen, setIsEditProgramOpen] = useState(false);
  const [editProgramForm, setEditProgramForm] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    status: "active",
  });
  const [editProgramLoading, setEditProgramLoading] = useState(false);

  // Cancel Program Modal
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Enroll Participant Modal
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    gender: "",
  });
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // Bulk Upload Modal
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  // Update Enrollment Status State
  const [updateEnrollmentTarget, setUpdateEnrollmentTarget] = useState<Enrollment | null>(null);
  const [newStatus, setNewStatus] = useState("registered");
  const [updateStatusLoading, setUpdateStatusLoading] = useState(false);

  // Drop Enrollment Confirmation State
  const [dropTarget, setDropTarget] = useState<Enrollment | null>(null);
  const [dropLoading, setDropLoading] = useState(false);

  const fetchProgramData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Program info
      const progRes = await fetch(`/api/programs/${id}`);
      const progJson = await progRes.json();
      if (!progRes.ok) throw new Error(progJson.error || "Failed to load program");
      setProgram(progJson.data);
      setEditProgramForm({
        name: progJson.data.name || "",
        description: progJson.data.description || "",
        start_date: progJson.data.start_date ? new Date(progJson.data.start_date).toISOString().split("T")[0] : "",
        end_date: progJson.data.end_date ? new Date(progJson.data.end_date).toISOString().split("T")[0] : "",
        status: progJson.data.status || "active",
      });

      // 2. Enrollments
      const enrollRes = await fetch(`/api/programs/${id}/enrollments`);
      const enrollJson = await enrollRes.json();
      if (enrollRes.ok) setEnrollments(enrollJson.data || []);

      // 3. Sessions preview
      const sessionRes = await fetch(`/api/programs/${id}/sessions?include_inactive=true`);
      const sessionJson = await sessionRes.json();
      if (sessionRes.ok) setSessions(sessionJson.data || []);

      // 4. Form template preview
      const formRes = await fetch(`/api/programs/${id}/form-template`);
      const formJson = await formRes.json();
      if (formRes.ok) setFormTemplate(formJson.data || null);

    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to load program details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgramData();
  }, [id]);

  const handleEditProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditProgramLoading(true);

    try {
      const res = await fetch(`/api/programs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editProgramForm.name,
          description: editProgramForm.description || null,
          start_date: editProgramForm.start_date || null,
          end_date: editProgramForm.end_date || null,
          status: editProgramForm.status,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update program");

      setIsEditProgramOpen(false);
      fetchProgramData();
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to update program");
    } finally {
      setEditProgramLoading(false);
    }
  };

  const handleCancelProgramConfirm = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/programs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to cancel program");
      }
      setIsCancelOpen(false);
      fetchProgramData();
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to cancel program");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollForm.email && !enrollForm.phone) {
      setEnrollError("At least one of email or phone is required");
      return;
    }

    setEnrollLoading(true);
    setEnrollError(null);

    try {
      const res = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: enrollForm.full_name,
          email: enrollForm.email || null,
          phone: enrollForm.phone || null,
          gender: enrollForm.gender || null,
          program_id: id,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to enroll participant");

      setIsEnrollModalOpen(false);
      setEnrollForm({ full_name: "", email: "", phone: "", gender: "" });
      fetchProgramData();
    } catch (err: unknown) {
      setEnrollError((err as { message?: string }).message || "Failed to enroll participant");
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleUpdateEnrollmentStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateEnrollmentTarget) return;

    setUpdateStatusLoading(true);
    try {
      const res = await fetch(`/api/enrollments/${updateEnrollmentTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update enrollment status");
      }

      setUpdateEnrollmentTarget(null);
      fetchProgramData();
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to update status");
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
      fetchProgramData();
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to drop enrollment");
    } finally {
      setDropLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
        <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
        <span>Loading program details...</span>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="space-y-4">
        <Link
          href="/programs"
          className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Programs</span>
        </Link>
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
          {error || "Program not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link & Program Header */}
      <div>
        <Link
          href="/programs"
          className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Programs</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{program.name}</h1>
              <StatusBadge status={program.status} />
            </div>
            <p className="text-xs text-slate-500">{program.description || "No description provided"}</p>
          </div>

          {isAdmin && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsEditProgramOpen(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-md transition flex items-center space-x-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Program</span>
              </button>
              {program.status !== "cancelled" && (
                <button
                  onClick={() => setIsCancelOpen(true)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium rounded-md transition flex items-center space-x-1.5 border border-rose-200"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Cancel Program</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Program Dates Overview */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center space-x-8 text-xs">
        <div>
          <span className="text-slate-400 font-medium block text-[11px]">Start Date</span>
          <span className="font-medium text-slate-900">
            {program.start_date ? new Date(program.start_date).toLocaleDateString() : "Not set"}
          </span>
        </div>
        <div className="border-l border-slate-200 pl-8">
          <span className="text-slate-400 font-medium block text-[11px]">End Date</span>
          <span className="font-medium text-slate-900">
            {program.end_date ? new Date(program.end_date).toLocaleDateString() : "Not set"}
          </span>
        </div>
        <div className="border-l border-slate-200 pl-8">
          <span className="text-slate-400 font-medium block text-[11px]">Total Enrollments</span>
          <span className="font-semibold text-slate-900">{enrollments.length}</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex space-x-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab("enrollments")}
          className={`pb-2.5 flex items-center space-x-1.5 border-b-2 transition ${
            activeTab === "enrollments"
              ? "border-teal-700 text-teal-700 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Enrollments ({enrollments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("sessions")}
          className={`pb-2.5 flex items-center space-x-1.5 border-b-2 transition ${
            activeTab === "sessions"
              ? "border-teal-700 text-teal-700 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Sessions ({sessions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("form-template")}
          className={`pb-2.5 flex items-center space-x-1.5 border-b-2 transition ${
            activeTab === "form-template"
              ? "border-teal-700 text-teal-700 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Intake Form Template {formTemplate ? "✓" : ""}</span>
        </button>
      </div>

      {/* TAB 1: ENROLLMENTS */}
      {activeTab === "enrollments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Enrolled Participants
            </h3>

            {isAssigned && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsBulkUploadOpen(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-md transition flex items-center space-x-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload CSV</span>
                </button>

                <button
                  onClick={() => setIsEnrollModalOpen(true)}
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md transition flex items-center space-x-1.5 shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Enroll Participant</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            {enrollments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No participants currently enrolled in this program.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Participant Name</th>
                      <th className="py-2.5 px-4">Email</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Enrolled Date</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {enrollments.map((en) => (
                      <tr key={en.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          <Link
                            href={`/participants/${en.participant.id}`}
                            className="hover:text-teal-700 hover:underline"
                          >
                            {en.participant.full_name}
                          </Link>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{en.participant.email || "—"}</td>
                        <td className="py-2.5 px-4">
                          <StatusBadge status={en.status} />
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {new Date(en.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-4 text-right space-x-2">
                          {isAssigned && (
                            <>
                              <button
                                onClick={() => {
                                  setUpdateEnrollmentTarget(en);
                                  setNewStatus(en.status);
                                }}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition"
                              >
                                Change Status
                              </button>
                              {en.status !== "dropped" && (
                                <button
                                  onClick={() => setDropTarget(en)}
                                  className="p-1 text-slate-400 hover:text-rose-600 inline-block"
                                  title="Drop Enrollment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SESSIONS PREVIEW */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Program Sessions
            </h3>
            <span className="text-xs text-slate-500">Full attendance marking available in Phase 8</span>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No sessions created for this program yet.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Session Title</th>
                    <th className="py-2.5 px-4">Session Date</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-4 font-medium text-slate-900">{s.title}</td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {new Date(s.session_date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                            s.is_active
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-600 border-slate-300"
                          }`}
                        >
                          {s.is_active ? "Active" : "Inactive (Soft-deleted)"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: INTAKE FORM TEMPLATE PREVIEW */}
      {activeTab === "form-template" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Intake Form Template Preview
            </h3>
            <span className="text-xs text-slate-500">Form builder UI available in Phase 8</span>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4 text-xs">
            {!formTemplate ? (
              <div className="p-8 text-center text-slate-500">
                No intake form template configured for this program yet.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-700" />
                  <span className="font-bold text-slate-900">{formTemplate.name}</span>
                </div>

                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4">Field Label</th>
                        <th className="py-2.5 px-4">Field Type</th>
                        <th className="py-2.5 px-4">Required</th>
                        <th className="py-2.5 px-4">Select Options</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formTemplate.fields.map((f, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-medium text-slate-900">{f.label}</td>
                          <td className="py-2.5 px-4 text-slate-600 capitalize font-mono text-[11px]">
                            {f.field_type}
                          </td>
                          <td className="py-2.5 px-4 font-semibold">
                            {f.required ? (
                              <span className="text-rose-600">Yes</span>
                            ) : (
                              <span className="text-slate-400">Optional</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">
                            {f.options && f.options.length > 0 ? f.options.join(", ") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Program Modal */}
      <Modal isOpen={isEditProgramOpen} onClose={() => setIsEditProgramOpen(false)} title="Edit Program Details">
        <form onSubmit={handleEditProgramSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Program Name</label>
            <input
              type="text"
              required
              value={editProgramForm.name}
              onChange={(e) => setEditProgramForm({ ...editProgramForm, name: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={editProgramForm.description}
              onChange={(e) => setEditProgramForm({ ...editProgramForm, description: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={editProgramForm.start_date}
                onChange={(e) => setEditProgramForm({ ...editProgramForm, start_date: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={editProgramForm.end_date}
                onChange={(e) => setEditProgramForm({ ...editProgramForm, end_date: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
            <select
              value={editProgramForm.status}
              onChange={(e) => setEditProgramForm({ ...editProgramForm, status: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditProgramOpen(false)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editProgramLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {editProgramLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel Program Confirmation Modal */}
      <ConfirmDialog
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        onConfirm={handleCancelProgramConfirm}
        title="Cancel Program"
        description={`Are you sure you want to cancel program "${program.name}"? Status will be updated to "cancelled".`}
        isLoading={cancelLoading}
        confirmLabel="Cancel Program"
      />

      {/* Enroll Participant Modal */}
      <Modal isOpen={isEnrollModalOpen} onClose={() => setIsEnrollModalOpen(false)} title="Enroll Participant">
        <form onSubmit={handleEnrollSubmit} className="space-y-4">
          {enrollError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{enrollError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={enrollForm.full_name}
              onChange={(e) => setEnrollForm({ ...enrollForm, full_name: e.target.value })}
              placeholder="e.g. Usman Danladi"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={enrollForm.email}
                onChange={(e) => setEnrollForm({ ...enrollForm, email: e.target.value })}
                placeholder="usman@example.com"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={enrollForm.phone}
                onChange={(e) => setEnrollForm({ ...enrollForm, phone: e.target.value })}
                placeholder="+234..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
            <select
              value={enrollForm.gender}
              onChange={(e) => setEnrollForm({ ...enrollForm, gender: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="">Select Gender</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEnrollModalOpen(false)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={enrollLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {enrollLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Enroll Participant</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Enrollment Status Modal */}
      <Modal
        isOpen={Boolean(updateEnrollmentTarget)}
        onClose={() => setUpdateEnrollmentTarget(null)}
        title={`Change Enrollment Status — ${updateEnrollmentTarget?.participant.full_name}`}
        maxWidth="sm"
      >
        <form onSubmit={handleUpdateEnrollmentStatusSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Enrollment Status</label>
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
        description={`Are you sure you want to drop "${dropTarget?.participant.full_name}" from this program? Status will be updated to "dropped".`}
        isLoading={dropLoading}
        confirmLabel="Drop Enrollment"
      />

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        programId={program.id}
        programName={program.name}
        onSuccess={fetchProgramData}
      />
    </div>
  );
}
