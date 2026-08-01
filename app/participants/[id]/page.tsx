"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit, Trash2, Calendar, Mail, Phone, User, ShieldCheck, GraduationCap, AlertCircle, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal, ConfirmDialog } from "@/components/ui/Dialog";
import { EditParticipantModal } from "@/components/EditParticipantModal";

type Course = {
  id: string;
  name: string;
};

type Enrollment = {
  id: string;
  program_id: string;
  course_id?: string | null;
  course?: Course | null;
  status: string;
  created_at: string;
  program: {
    id: string;
    name: string;
    status: string;
    courses?: Course[];
  };
};

type ParticipantDetail = {
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
  created_at: string;
  enrollments: Enrollment[];
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export default function ParticipantDetailPage({ params }: RouteContext) {
  const { id } = use(params);
  const router = useRouter();

  const [participant, setParticipant] = useState<ParticipantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    nin_number: "",
    qualification: "",
    email: "",
    phone: "",
    gender: "",
    date_of_birth: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Modal State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Enrollment Action Modals State
  const [updateEnrollmentTarget, setUpdateEnrollmentTarget] = useState<Enrollment | null>(null);
  const [newStatus, setNewStatus] = useState("registered");
  const [updateStatusLoading, setUpdateStatusLoading] = useState(false);

  const [changeCourseTarget, setChangeCourseTarget] = useState<Enrollment | null>(null);
  const [changeCourseSelectedId, setChangeCourseSelectedId] = useState("");
  const [changeCourseLoading, setChangeCourseLoading] = useState(false);

  const [dropTarget, setDropTarget] = useState<Enrollment | null>(null);
  const [dropLoading, setDropLoading] = useState(false);

  const fetchParticipant = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/participants/${id}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load participant details");
      }
      setParticipant(json.data);
      setEditForm({
        first_name: json.data.first_name || "",
        middle_name: json.data.middle_name || "",
        last_name: json.data.last_name || "",
        nin_number: json.data.nin_number || "",
        qualification: json.data.qualification || "",
        email: json.data.email || "",
        phone: json.data.phone || "",
        gender: json.data.gender || "",
        date_of_birth: json.data.date_of_birth
          ? new Date(json.data.date_of_birth).toISOString().split("T")[0]
          : "",
      });
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to load participant");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipant();
  }, [id]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError(null);

    const trimmedNin = editForm.nin_number.trim();
    if (trimmedNin && !/^\d{11}$/.test(trimmedNin)) {
      setEditError("NIN number must be exactly 11 numeric digits");
      setEditLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/participants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: editForm.first_name,
          middle_name: editForm.middle_name || null,
          last_name: editForm.last_name,
          nin_number: trimmedNin,
          qualification: editForm.qualification || null,
          email: editForm.email || null,
          phone: editForm.phone || null,
          gender: editForm.gender || null,
          date_of_birth: editForm.date_of_birth || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update participant");
      }

      setIsEditOpen(false);
      fetchParticipant();
    } catch (err: unknown) {
      setEditError((err as { message?: string }).message || "Failed to update participant");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/participants/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to delete participant");
      }
      router.push("/participants");
      router.refresh();
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to delete participant");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Update Enrollment Status Action
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
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update enrollment status");
      }
      setUpdateEnrollmentTarget(null);
      await fetchParticipant();
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to update status");
    } finally {
      setUpdateStatusLoading(false);
    }
  };

  // Change Course Action
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
      await fetchParticipant();
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to update course");
    } finally {
      setChangeCourseLoading(false);
    }
  };

  // Drop Enrollment Action
  const handleDropEnrollmentConfirm = async () => {
    if (!dropTarget) return;
    setDropLoading(true);
    try {
      const res = await fetch(`/api/enrollments/${dropTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to drop enrollment");
      }
      setDropTarget(null);
      await fetchParticipant();
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
        <span>Loading participant details...</span>
      </div>
    );
  }

  if (error || !participant) {
    return (
      <div className="space-y-4">
        <Link
          href="/participants"
          className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Participants</span>
        </Link>
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
          {error || "Participant not found"}
        </div>
      </div>
    );
  }

  const displayName = participant.full_name || [participant.first_name, participant.middle_name, participant.last_name].filter(Boolean).join(" ");
  const isNinInvalid = Boolean(participant.nin_number && !/^\d{11}$/.test(participant.nin_number.trim()));

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <div>
        <Link
          href="/participants"
          className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Participants</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {displayName}
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsEditOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-md transition flex items-center space-x-1.5"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit Info</span>
            </button>
            <button
              onClick={() => setIsDeleteOpen(true)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium rounded-md transition flex items-center space-x-1.5 border border-rose-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Participant</span>
            </button>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
        <div className="space-y-1">
          <span className="text-slate-400 font-medium flex items-center space-x-1">
            <User className="w-3.5 h-3.5 text-teal-700" />
            <span>Full Name</span>
          </span>
          <p className="font-semibold text-slate-900">
            {participant.first_name} {participant.middle_name ? `"${participant.middle_name}" ` : ""}{participant.last_name}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-medium flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
            <span>NIN Number</span>
          </span>
          <p className="font-mono text-slate-900 flex items-center space-x-1.5">
            <span>{participant.nin_number || "—"}</span>
            {isNinInvalid && (
              <span
                className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-sans font-medium"
                title="Invalid NIN format (must be exactly 11 numeric digits)"
              >
                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                <span>11 digits required</span>
              </span>
            )}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-medium flex items-center space-x-1">
            <GraduationCap className="w-3.5 h-3.5 text-teal-700" />
            <span>Qualification</span>
          </span>
          <p className="font-semibold text-slate-900">{participant.qualification || "—"}</p>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-medium flex items-center space-x-1">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span>Email</span>
          </span>
          <p className="font-medium text-slate-900">{participant.email || "—"}</p>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-medium flex items-center space-x-1">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>Phone</span>
          </span>
          <p className="font-mono text-slate-900">{participant.phone || "—"}</p>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 font-medium flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Date of Birth</span>
          </span>
          <p className="font-medium text-slate-900">
            {participant.date_of_birth
              ? new Date(participant.date_of_birth).toLocaleDateString()
              : "—"}
          </p>
        </div>
      </div>

      {/* Program Enrollments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Program Enrollments</h2>
          <span className="text-xs text-slate-500">
            Enrolled in {participant.enrollments.length} program(s)
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          {participant.enrollments.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              This participant is not currently enrolled in any programs.
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Program Name</th>
                  <th className="py-2.5 px-4">Course / Track</th>
                  <th className="py-2.5 px-4">Enrollment Status</th>
                  <th className="py-2.5 px-4">Program Status</th>
                  <th className="py-2.5 px-4">Enrolled Date</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participant.enrollments.map((en) => (
                  <tr key={en.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      <Link
                        href={`/programs/${en.program.id}`}
                        className="hover:text-teal-700 hover:underline"
                      >
                        {en.program.name}
                      </Link>
                    </td>
                    <td className="py-2.5 px-4">
                      {en.course?.name ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-medium text-[11px]">
                          {en.course.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Program Level</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={en.status} />
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={en.program.status} />
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {new Date(en.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-1.5">
                      {en.program.courses && en.program.courses.length > 0 && (
                        <button
                          onClick={() => {
                            setChangeCourseTarget(en);
                            setChangeCourseSelectedId(en.course_id || en.course?.id || "");
                          }}
                          className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded text-[11px] font-medium transition"
                        >
                          Change Course
                        </button>
                      )}
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
                          className="p-1 text-slate-400 hover:text-rose-600 inline-block align-middle"
                          title="Drop Enrollment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Participant Modal */}
      <EditParticipantModal
        isOpen={isEditOpen}
        participant={participant}
        onClose={() => setIsEditOpen(false)}
        onSuccess={fetchParticipant}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Participant"
        description={`Are you sure you want to delete "${displayName}"?`}
        isLoading={deleteLoading}
      />

      {/* Change Status Modal */}
      <Modal
        isOpen={Boolean(updateEnrollmentTarget)}
        onClose={() => setUpdateEnrollmentTarget(null)}
        title={`Change Enrollment Status — ${updateEnrollmentTarget?.program.name}`}
      >
        <form onSubmit={handleUpdateStatusConfirm} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Select New Status
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
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
              <span>Save Status</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Course Modal */}
      <Modal
        isOpen={Boolean(changeCourseTarget)}
        onClose={() => setChangeCourseTarget(null)}
        title={`Change Course / Track — ${changeCourseTarget?.program.name}`}
      >
        <form onSubmit={handleChangeCourseSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Select Course / Track
            </label>
            <select
              value={changeCourseSelectedId}
              onChange={(e) => setChangeCourseSelectedId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="">No Specific Course (Program Level Only)</option>
              {changeCourseTarget?.program.courses?.map((c) => (
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
              <span>Update Course</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Drop Enrollment Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(dropTarget)}
        onClose={() => setDropTarget(null)}
        onConfirm={handleDropEnrollmentConfirm}
        title="Drop Program Enrollment"
        description={`Are you sure you want to set enrollment status to "dropped" for ${dropTarget?.program.name}?`}
        isLoading={dropLoading}
      />
    </div>
  );
}
