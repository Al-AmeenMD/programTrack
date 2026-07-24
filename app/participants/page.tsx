"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search, UserPlus, Trash2, Eye, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
import { Modal, ConfirmDialog } from "@/components/ui/Dialog";
import { useAuth } from "@/components/AuthProvider";

type Participant = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  status: string;
  enrollment_count?: number;
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
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [total, setTotal] = useState(0);

  // Add Participant Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    gender: "",
    date_of_birth: "",
    program_id: "",
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Available programs for drop-down
  const [programs, setPrograms] = useState<ProgramOption[]>([]);

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
      const res = await fetch("/api/programs");
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
  }, [page, search]);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.email && !addForm.phone) {
      setAddError("At least one of email or phone is required");
      return;
    }

    setAddLoading(true);
    setAddError(null);

    try {
      const res = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: addForm.full_name,
          email: addForm.email || null,
          phone: addForm.phone || null,
          gender: addForm.gender || null,
          date_of_birth: addForm.date_of_birth || null,
          ...(addForm.program_id ? { program_id: addForm.program_id } : {}),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create participant");
      }

      setIsAddOpen(false);
      setAddForm({ full_name: "", email: "", phone: "", gender: "", date_of_birth: "", program_id: "" });
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
      <div className="flex items-center space-x-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
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
                  <th className="py-2.5 px-4">Full Name</th>
                  <th className="py-2.5 px-4">Email</th>
                  <th className="py-2.5 px-4">Phone</th>
                  <th className="py-2.5 px-4">Gender</th>
                  <th className="py-2.5 px-4">Date of Birth</th>
                  <th className="py-2.5 px-4">Enrollments</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participants.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      <Link
                        href={`/participants/${p.id}`}
                        className="hover:text-teal-700 hover:underline"
                      >
                        {p.full_name}
                      </Link>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{p.email || "—"}</td>
                    <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">{p.phone || "—"}</td>
                    <td className="py-2.5 px-4 text-slate-600 capitalize">{p.gender || "—"}</td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {p.enrollment_count ?? 0} program(s)
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
                ))}
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

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={addForm.full_name}
              onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
              placeholder="e.g. Fatima Ali"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
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
