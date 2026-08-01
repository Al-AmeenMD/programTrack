"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Dialog";
import { AlertCircle } from "lucide-react";

export type ParticipantToEdit = {
  id: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  nin_number?: string | null;
  qualification?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
};

interface EditParticipantModalProps {
  isOpen: boolean;
  participant: ParticipantToEdit | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditParticipantModal({
  isOpen,
  participant,
  onClose,
  onSuccess,
}: EditParticipantModalProps) {
  const [form, setForm] = useState({
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (participant) {
      let fName = participant.first_name || "";
      let mName = participant.middle_name || "";
      let lName = participant.last_name || "";

      if (!fName && participant.full_name) {
        const parts = participant.full_name.trim().split(/\s+/);
        fName = parts[0] || "";
        lName = parts.length > 1 ? parts.slice(1).join(" ") : "";
      }

      setForm({
        first_name: fName,
        middle_name: mName,
        last_name: lName,
        nin_number: participant.nin_number || "",
        qualification: participant.qualification || "",
        email: participant.email || "",
        phone: participant.phone || "",
        gender: participant.gender || "",
        date_of_birth: participant.date_of_birth
          ? participant.date_of_birth.split("T")[0]
          : "",
      });
      setError(null);
    }
  }, [participant, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participant) return;

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("First Name and Last Name are required");
      return;
    }

    if (form.nin_number && !/^\d{11}$/.test(form.nin_number.trim())) {
      setError("NIN number must be exactly 11 numeric digits");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/participants/${participant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          middle_name: form.middle_name.trim() || null,
          last_name: form.last_name.trim(),
          nin_number: form.nin_number.trim() || null,
          qualification: form.qualification.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          gender: form.gender.trim() || null,
          date_of_birth: form.date_of_birth || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update participant");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to update participant");
    } finally {
      setLoading(false);
    }
  };

  if (!participant) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Participant Info">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              First Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Middle Name
            </label>
            <input
              type="text"
              value={form.middle_name}
              onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Last Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              NIN (11 Digits)
            </label>
            <input
              type="text"
              maxLength={11}
              value={form.nin_number}
              onChange={(e) => setForm({ ...form, nin_number: e.target.value })}
              placeholder="e.g. 12345678901"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500 outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Highest Qualification
            </label>
            <input
              type="text"
              value={form.qualification}
              onChange={(e) => setForm({ ...form, qualification: e.target.value })}
              placeholder="e.g. BSc Computer Science"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Gender
            </label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500 outline-none bg-white"
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Date of Birth
            </label>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md shadow-xs transition disabled:opacity-50 flex items-center space-x-1"
          >
            {loading ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
