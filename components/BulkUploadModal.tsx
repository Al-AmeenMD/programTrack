"use client";

import React, { useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, X } from "lucide-react";
import { Modal } from "./ui/Dialog";

type BulkUploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  programId: string;
  programName: string;
  onSuccess: () => void;
};

type PreviewRow = {
  row_number: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  action: "new_participant" | "new_enrollment" | "skip";
  skip_reason: string | null;
};

type PreviewSummary = {
  total: number;
  new_participant_count: number;
  new_enrollment_count: number;
  skipped_count: number;
  rows: PreviewRow[];
};

type CommitResultSummary = {
  total: number;
  created_count: number;
  enrolled_count: number;
  skipped_count: number;
  skipped_details: Array<{
    row_number: number;
    full_name: string;
    reason: string;
  }>;
};

export function BulkUploadModal({
  isOpen,
  onClose,
  programId,
  programName,
  onSuccess,
}: BulkUploadModalProps) {
  const [step, setStep] = useState<"file" | "preview" | "results">("file");
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<PreviewSummary | null>(null);
  const [results, setResults] = useState<CommitResultSummary | null>(null);

  const handleReset = () => {
    setStep("file");
    setFile(null);
    setFileText("");
    setLoading(false);
    setError(null);
    setPreview(null);
    setResults(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        setFileText(event.target?.result as string);
      };
      reader.readAsText(selectedFile);
    }
  };

  const handlePreview = async () => {
    if (!fileText) {
      setError("Please select a valid CSV file");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/programs/${programId}/bulk-upload`, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: fileText,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to parse CSV preview");
      }

      setPreview(json.data);
      setStep("preview");
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to process preview");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!fileText) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/programs/${programId}/bulk-upload/commit`, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: fileText,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to commit import");
      }

      setResults(json.data);
      setStep("results");
      onSuccess();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to commit bulk upload");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Bulk Upload Participants — ${programName}`}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: FILE SELECTION */}
        {step === "file" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Select a CSV file containing participant records. Expected headers:{" "}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">
                full_name, email, phone, gender, date_of_birth
              </code>
            </p>

            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-teal-600 transition bg-slate-50/50">
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <input
                type="file"
                accept=".csv"
                id="csv-file-input"
                className="hidden"
                onChange={handleFileChange}
              />
              <label
                htmlFor="csv-file-input"
                className="cursor-pointer text-xs font-medium text-teal-700 hover:text-teal-800 underline"
              >
                Click to choose CSV file
              </label>
              {file && (
                <div className="mt-2 text-xs font-semibold text-slate-800 flex items-center justify-center space-x-1.5">
                  <FileText className="w-4 h-4 text-teal-700" />
                  <span>{file.name}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={!file || loading}
                className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
              >
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Preview Dry Run</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW DRY RUN */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 bg-slate-100 rounded border border-slate-200">
                <span className="block text-slate-500 font-medium">Total Rows</span>
                <span className="text-sm font-bold text-slate-900">{preview.total}</span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded border border-emerald-200">
                <span className="block text-emerald-700 font-medium">New Participants</span>
                <span className="text-sm font-bold text-emerald-800">
                  {preview.new_participant_count}
                </span>
              </div>
              <div className="p-2.5 bg-sky-50 rounded border border-sky-200">
                <span className="block text-sky-700 font-medium">Existing Enrolled</span>
                <span className="text-sm font-bold text-sky-800">
                  {preview.new_enrollment_count}
                </span>
              </div>
              <div className="p-2.5 bg-amber-50 rounded border border-amber-200">
                <span className="block text-amber-700 font-medium">Skipped</span>
                <span className="text-sm font-bold text-amber-800">
                  {preview.skipped_count}
                </span>
              </div>
            </div>

            {/* Dry Run Table */}
            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-md">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Row</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Contact</th>
                    <th className="py-2 px-3">Action Preview</th>
                    <th className="py-2 px-3">Reason / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.map((r) => (
                    <tr key={r.row_number} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono text-slate-500">{r.row_number}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">
                        {r.full_name || "—"}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {r.email || r.phone || "—"}
                      </td>
                      <td className="py-2 px-3">
                        {r.action === "new_participant" && (
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            Create New
                          </span>
                        )}
                        {r.action === "new_enrollment" && (
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-sky-100 text-sky-800">
                            Match & Enroll
                          </span>
                        )}
                        {r.action === "skip" && (
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                            Skip
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-500 text-[11px]">
                        {r.skip_reason || "Will be imported successfully"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep("file")}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                Back to File Selection
              </button>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={loading}
                  className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm & Import Rows</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: RESULTS SUMMARY */}
        {step === "results" && results && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-semibold">Import Complete!</span>
                <p className="text-[11px] text-emerald-700">
                  Processed {results.total} rows ({results.created_count} new participants created,{" "}
                  {results.enrolled_count} existing matched and enrolled).
                </p>
              </div>
            </div>

            {results.skipped_details.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-700">Skipped Rows Breakdown:</h4>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-md">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-1.5 px-3">Row</th>
                        <th className="py-1.5 px-3">Name</th>
                        <th className="py-1.5 px-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.skipped_details.map((s, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 px-3 font-mono text-slate-500">{s.row_number}</td>
                          <td className="py-1.5 px-3 font-medium text-slate-800">
                            {s.full_name || "—"}
                          </td>
                          <td className="py-1.5 px-3 text-amber-700">{s.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-1.5 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white transition"
              >
                Close Window
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
