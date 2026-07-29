import React from "react";

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase();

  let styles = "bg-slate-100 text-slate-700 border-slate-200";
  if (normalized === "active") {
    styles = "bg-emerald-50 text-emerald-800 border-emerald-200";
  } else if (normalized === "registered" || normalized === "upcoming") {
    styles = "bg-sky-50 text-sky-800 border-sky-200";
  } else if (normalized === "completed") {
    styles = "bg-purple-50 text-purple-800 border-purple-200";
  } else if (normalized === "dropped" || normalized === "cancelled" || normalized === "inactive") {
    styles = "bg-rose-50 text-rose-800 border-rose-200";
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border capitalize ${styles}`}
    >
      {status}
    </span>
  );
}
