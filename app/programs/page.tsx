"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Eye, Ban, AlertCircle, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal, ConfirmDialog } from "@/components/ui/Dialog";
import { useAuth } from "@/components/AuthProvider";

type Program = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
  enrollments?: Array<{ id: string }>;
};

export default function ProgramsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Program Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    status: "active",
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Cancel Program Confirmation State
  const [cancelTarget, setCancelTarget] = useState<Program | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchPrograms = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/programs");
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load programs");
      }

      setPrograms(json.data || []);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to load programs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);

    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name,
          description: addForm.description || null,
          start_date: addForm.start_date || null,
          end_date: addForm.end_date || null,
          status: addForm.status,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create program");
      }

      setIsAddOpen(false);
      setAddForm({ name: "", description: "", start_date: "", end_date: "", status: "active" });
      fetchPrograms();
    } catch (err: unknown) {
      setAddError((err as { message?: string }).message || "Failed to create program");
    } finally {
      setAddLoading(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);

    try {
      const res = await fetch(`/api/programs/${cancelTarget.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to cancel program");
      }

      setCancelTarget(null);
      fetchPrograms();
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to cancel program");
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Programs</h1>
          <p className="text-xs text-slate-500">
            {isAdmin
              ? "System-wide program catalog and status management"
              : "Programs assigned to your facilitator account"}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs rounded-md shadow-xs transition flex items-center justify-center space-x-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Program</span>
          </button>
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
            <span>Loading programs...</span>
          </div>
        ) : programs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No programs found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Program Name</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Start Date</th>
                  <th className="py-2.5 px-4">End Date</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {programs.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      <Link
                        href={`/programs/${p.id}`}
                        className="hover:text-teal-700 hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {p.start_date ? new Date(p.start_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {p.end_date ? new Date(p.end_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-2">
                      <Link
                        href={`/programs/${p.id}`}
                        className="p-1 text-slate-500 hover:text-teal-700 inline-block"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      {isAdmin && p.status !== "cancelled" && (
                        <button
                          onClick={() => setCancelTarget(p)}
                          className="p-1 text-slate-400 hover:text-rose-600 inline-block"
                          title="Cancel Program"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Program Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Create New Program">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {addError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Program Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              placeholder="e.g. Data Analytics Cohort 4"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={addForm.description}
              onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              placeholder="Program overview and objectives..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={addForm.start_date}
                onChange={(e) => setAddForm({ ...addForm, start_date: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={addForm.end_date}
                onChange={(e) => setAddForm({ ...addForm, end_date: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Initial Status</label>
            <select
              value={addForm.status}
              onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
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
              <span>Save Program</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirm}
        title="Cancel Program"
        description={`Are you sure you want to cancel program "${cancelTarget?.name}"? Its status will be updated to "cancelled".`}
        isLoading={cancelLoading}
        confirmLabel="Cancel Program"
      />
    </div>
  );
}
