"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Dialog";
import { AlertCircle } from "lucide-react";

interface AddParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  programId?: string;
  courseId?: string;
  programs?: { id: string; name: string }[];
  courses?: { id: string; name: string }[];
}

export function AddParticipantModal({
  isOpen,
  onClose,
  onSuccess,
  programId,
  courseId,
  programs = [],
  courses = [],
}: AddParticipantModalProps) {
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
    program_id: programId || "",
    course_id: courseId || "",
  });

  const [availableCourses, setAvailableCourses] = useState<{ id: string; name: string }[]>(courses);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm({
        first_name: "",
        middle_name: "",
        last_name: "",
        nin_number: "",
        qualification: "",
        email: "",
        phone: "",
        gender: "",
        date_of_birth: "",
        program_id: programId || "",
        course_id: courseId || "",
      });
      setError(null);
    }
  }, [isOpen, programId, courseId]);

  // Fetch courses dynamically if program_id changes and courses weren't passed in
  useEffect(() => {
    const activeProgramId = form.program_id || programId;
    if (activeProgramId && courses.length === 0) {
      setCoursesLoading(true);
      fetch(`/api/programs/${activeProgramId}/courses`)
        .then((res) => res.json())
        .then((json) => {
          setAvailableCourses(json.data || []);
        })
        .catch(() => setAvailableCourses([]))
        .finally(() => setCoursesLoading(false));
    } else {
      setAvailableCourses(courses);
    }
  }, [form.program_id, programId, courses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      const payload = {
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim() || null,
        last_name: form.last_name.trim(),
        nin_number: form.nin_number.trim() || undefined,
        qualification: form.qualification.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        gender: form.gender.trim() || null,
        date_of_birth: form.date_of_birth || null,
        program_id: form.program_id || programId || undefined,
        course_id: form.course_id || courseId || undefined,
      };

      const targetUrl = programId ? `/api/programs/${programId}/enrollments` : "/api/participants";

      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to enroll participant");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to enroll participant");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={programId ? "Enroll New Participant" : "Add Participant"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Split Name Fields */}
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

        {/* Contact Fields */}
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

        {/* NIN & Qualification */}
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

        {/* Gender & Date of Birth */}
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

        {/* Program & Course Selectors (If applicable) */}
        {!programId && programs.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assign to Program
            </label>
            <select
              value={form.program_id}
              onChange={(e) => setForm({ ...form, program_id: e.target.value, course_id: "" })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500 outline-none bg-white"
            >
              <option value="">No Program (General Directory Only)</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {(availableCourses.length > 0 || coursesLoading) && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assign to Course / Track
            </label>
            <select
              disabled={coursesLoading}
              value={form.course_id}
              onChange={(e) => setForm({ ...form, course_id: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500 outline-none bg-white disabled:opacity-50"
            >
              <option value="">No Specific Course (Program Level)</option>
              {availableCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Form Actions */}
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
            {loading ? "Enrolling Participant..." : programId ? "Enroll Participant" : "Add Participant"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
