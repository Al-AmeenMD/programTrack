import React from "react";

type BadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className = "" }: BadgeProps) {
  const normalized = status.toLowerCase();

  let styles = "bg-slate-100 text-slate-700 border-slate-200";

  switch (normalized) {
    case "active":
      styles = "bg-emerald-50 text-emerald-700 border-emerald-200";
      break;
    case "upcoming":
      styles = "bg-sky-50 text-sky-700 border-sky-200";
      break;
    case "completed":
      styles = "bg-slate-100 text-slate-700 border-slate-300";
      break;
    case "cancelled":
      styles = "bg-rose-50 text-rose-700 border-rose-200";
      break;
    case "registered":
      styles = "bg-amber-50 text-amber-700 border-amber-200";
      break;
    case "dropped":
      styles = "bg-zinc-100 text-zinc-600 border-zinc-300";
      break;
    default:
      styles = "bg-slate-100 text-slate-700 border-slate-200";
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize ${styles} ${className}`}
    >
      {status}
    </span>
  );
}
