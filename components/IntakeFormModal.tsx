"use client";

import React, { useEffect, useState } from "react";
import { RefreshCw, AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { Modal } from "./ui/Dialog";

export type FormField = {
  id?: string;
  label: string;
  field_type: "text" | "number" | "select" | "date" | "checkbox";
  required: boolean;
  options?: string[];
};

export type FormTemplate = {
  id: string;
  name: string;
  fields: FormField[];
};

type IntakeFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  enrollmentId: string | null;
  participantName: string;
  programId: string;
  onSuccess?: () => void;
};

export function IntakeFormModal({
  isOpen,
  onClose,
  enrollmentId,
  participantName,
  programId,
  onSuccess,
}: IntakeFormModalProps) {
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [existingResponseId, setExistingResponseId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && enrollmentId && programId) {
      const loadFormData = async () => {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);

        try {
          // Fetch template for program
          const templateRes = await fetch(`/api/programs/${programId}/form-template`);
          const templateJson = await templateRes.json();
          if (!templateRes.ok) throw new Error(templateJson.error || "Failed to load form template");
          
          const tmpl = templateJson.data as FormTemplate | null;
          setTemplate(tmpl);

          if (tmpl) {
            // Initialize empty answers for template fields
            const initialAnswers: Record<string, unknown> = {};
            (tmpl.fields || []).forEach((f) => {
              if (f.field_type === "checkbox") {
                initialAnswers[f.label] = false;
              } else {
                initialAnswers[f.label] = "";
              }
            });

            // Fetch existing response if present
            const respRes = await fetch(`/api/enrollments/${enrollmentId}/form-response`);
            if (respRes.ok) {
              const respJson = await respRes.json();
              if (respJson.data) {
                setExistingResponseId(respJson.data.id);
                setAnswers({
                  ...initialAnswers,
                  ...(respJson.data.answers || {}),
                });
              } else {
                setExistingResponseId(null);
                setAnswers(initialAnswers);
              }
            } else {
              setExistingResponseId(null);
              setAnswers(initialAnswers);
            }
          }
        } catch (err: unknown) {
          setError((err as { message?: string }).message || "Error loading intake form");
        } finally {
          setLoading(false);
        }
      };

      loadFormData();
    }
  }, [isOpen, enrollmentId, programId]);

  if (!isOpen || !enrollmentId) return null;

  const handleFieldChange = (label: string, value: unknown) => {
    setAnswers((prev) => ({
      ...prev,
      [label]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;

    // Client-side required field validation
    for (const field of template.fields || []) {
      if (field.required) {
        const val = answers[field.label];
        if (
          val === undefined ||
          val === null ||
          (typeof val === "string" && val.trim() === "") ||
          (field.field_type === "checkbox" && val !== true)
        ) {
          setError(`Required field "${field.label}" must be filled out.`);
          return;
        }
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/enrollments/${enrollmentId}/form-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit intake form");

      setSuccessMsg(existingResponseId ? "Intake response updated successfully!" : "Intake form submitted successfully!");
      setExistingResponseId(json.data.id);

      if (onSuccess) onSuccess();

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to submit intake form");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Intake Form — ${participantName}`}
      maxWidth="lg"
    >
      <div className="space-y-4 text-xs">
        {loading ? (
          <div className="p-8 text-center text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
            <span>Loading intake form template...</span>
          </div>
        ) : !template ? (
          <div className="p-6 text-center text-slate-500 bg-slate-50 rounded border border-slate-200">
            No intake form template has been configured for this program yet.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-1.5 text-slate-800 font-bold">
                <FileText className="w-4 h-4 text-teal-700" />
                <span>{template.name}</span>
              </div>
              {existingResponseId && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[11px] font-semibold">
                  ✓ Response Recorded
                </span>
              )}
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-md flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {(template.fields || []).map((field, idx) => {
                const val = answers[field.label];
                return (
                  <div key={idx} className="space-y-1">
                    <label className="block font-medium text-slate-700">
                      {field.label}
                      {field.required && <span className="text-rose-500 ml-0.5">*</span>}
                    </label>

                    {field.field_type === "text" && (
                      <input
                        type="text"
                        required={field.required}
                        value={(val as string) || ""}
                        onChange={(e) => handleFieldChange(field.label, e.target.value)}
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                      />
                    )}

                    {field.field_type === "number" && (
                      <input
                        type="number"
                        required={field.required}
                        value={val !== undefined && val !== null ? String(val) : ""}
                        onChange={(e) => handleFieldChange(field.label, e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                      />
                    )}

                    {field.field_type === "date" && (
                      <input
                        type="date"
                        required={field.required}
                        value={(val as string) || ""}
                        onChange={(e) => handleFieldChange(field.label, e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                      />
                    )}

                    {field.field_type === "select" && (
                      <select
                        required={field.required}
                        value={(val as string) || ""}
                        onChange={(e) => handleFieldChange(field.label, e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                      >
                        <option value="">Select option...</option>
                        {(field.options || []).map((opt, oIdx) => (
                          <option key={oIdx} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}

                    {field.field_type === "checkbox" && (
                      <label className="flex items-center space-x-2 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          onChange={(e) => handleFieldChange(field.label, e.target.checked)}
                          className="w-4 h-4 text-teal-700 rounded border-slate-300 focus:ring-teal-700/20"
                        />
                        <span className="text-slate-600">Yes / Confirmed</span>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{existingResponseId ? "Update Response" : "Submit Form Response"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
