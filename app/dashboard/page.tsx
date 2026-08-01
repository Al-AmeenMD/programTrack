"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  ArrowUpRight,
  PieChart,
  Activity,
  Award,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { useAuth } from "@/components/AuthProvider";
import { exportToCsv } from "@/lib/exportCsv";

type DashboardStats = {
  role: string;
  totalPrograms: number;
  programStatusCounts: {
    upcoming: number;
    active: number;
    completed: number;
    cancelled: number;
  };
  totalActiveParticipants: number;
  totalEnrollments: number;
  statusCounts: {
    registered: number;
    active: number;
    completed: number;
    dropped: number;
  };
  completionRate: number;
  dropoutRate: number;
  enrollmentTrend: Array<{ period: string; count: number }>;
};

// Custom Tooltip for Recharts
function CustomChartTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div className="bg-slate-900 text-white text-xs py-2 px-3 rounded-lg shadow-xl border border-slate-700 z-50">
        <p className="font-semibold text-slate-300">{label}</p>
        <p className="text-sm font-bold text-teal-300 mt-0.5">
          {value} {value === 1 ? "enrollment" : "enrollments"}
        </p>
      </div>
    );
  }
  return null;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) {
        throw new Error("Failed to load dashboard statistics");
      }
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleExportCsv = () => {
    if (!stats) return;

    const summaryData = [
      { Metric: "Total Active Participants", Value: stats.totalActiveParticipants },
      { Metric: "Total Programs", Value: stats.totalPrograms },
      { Metric: "Active Programs", Value: stats.programStatusCounts.active },
      { Metric: "Upcoming Programs", Value: stats.programStatusCounts.upcoming },
      { Metric: "Completed Programs", Value: stats.programStatusCounts.completed },
      { Metric: "Cancelled Programs", Value: stats.programStatusCounts.cancelled },
      { Metric: "Total Enrollments", Value: stats.totalEnrollments },
      { Metric: "Registered Enrollments", Value: stats.statusCounts.registered },
      { Metric: "Active Enrollments", Value: stats.statusCounts.active },
      { Metric: "Completed Enrollments", Value: stats.statusCounts.completed },
      { Metric: "Dropped Enrollments", Value: stats.statusCounts.dropped },
      { Metric: "Completion Rate (%)", Value: `${stats.completionRate}%` },
      { Metric: "Dropout Rate (%)", Value: `${stats.dropoutRate}%` },
    ];

    const today = new Date().toISOString().split("T")[0];
    exportToCsv(`programtrack_summary_metrics_${today}.csv`, summaryData);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Loading system analytics...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3 max-w-lg mx-auto my-12">
        <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
        <p className="text-sm font-semibold text-rose-900">{error || "Failed to load dashboard data"}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  // Calculate real data-backed MoM trend if historical trend data exists
  let trendIndicator: { label: string; isPositive: boolean } | null = null;
  if (stats.enrollmentTrend && stats.enrollmentTrend.length >= 2) {
    const currentMonth = stats.enrollmentTrend[stats.enrollmentTrend.length - 1];
    const prevMonth = stats.enrollmentTrend[stats.enrollmentTrend.length - 2];

    if (prevMonth.count > 0) {
      const pct = Math.round(((currentMonth.count - prevMonth.count) / prevMonth.count) * 100);
      if (pct !== 0) {
        trendIndicator = {
          label: `${pct > 0 ? "+" : ""}${pct}% MoM`,
          isPositive: pct > 0,
        };
      }
    } else if (currentMonth.count > 0) {
      trendIndicator = {
        label: `+${currentMonth.count} new`,
        isPositive: true,
      };
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {stats.role === "admin" ? "System Analytics & Program Health" : "Assigned Program Analytics"}
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-teal-100 text-teal-800 uppercase tracking-wide">
              {stats.role}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time breakdown of participant activity, completion metrics, and enrollment trends across {stats.totalPrograms} program{stats.totalPrograms === 1 ? "" : "s"}.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Summary CSV</span>
          </button>
        </div>
      </div>

      {/* TOP LEVEL KPIs - UNBOXED, CONFIDENT TYPOGRAPHY (Stripe / Linear style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 py-2 border-b border-slate-200/70 pb-8">
        {/* KPI 1: Primary Focus — Total Active Participants */}
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <span>Active Participants</span>
          </p>
          <div className="flex items-baseline space-x-2.5">
            <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
              {stats.totalActiveParticipants}
            </span>
            {trendIndicator && (
              <span
                className={`inline-flex items-center text-xs font-extrabold px-2 py-0.5 rounded-full ${
                  trendIndicator.isPositive
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                    : "bg-rose-50 text-rose-700 border border-rose-200/60"
                }`}
              >
                {trendIndicator.isPositive ? (
                  <TrendingUp className="w-3 h-3 mr-1 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1 text-rose-600" />
                )}
                {trendIndicator.label}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium">
            {stats.totalEnrollments} total enrollments across all cohorts
          </p>
        </div>

        {/* KPI 2: Active Programs / Cohorts */}
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active Cohorts
          </p>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {stats.programStatusCounts.active}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              / {stats.totalPrograms} total
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            {stats.programStatusCounts.upcoming} upcoming program{stats.programStatusCounts.upcoming === 1 ? "" : "s"}
          </p>
        </div>

        {/* KPI 3: Completion Rate */}
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Completion Rate
          </p>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {stats.completionRate}%
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            {stats.statusCounts.completed} successful graduate{stats.statusCounts.completed === 1 ? "" : "s"}
          </p>
        </div>

        {/* KPI 4: Dropout Rate */}
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Dropout Rate
          </p>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {stats.dropoutRate}%
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            {stats.statusCounts.dropped} dropped / withdrawn
          </p>
        </div>
      </div>

      {/* Main Section 1: Recharts Enrollment Trend Over Time Chart */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-teal-50 rounded-xl text-teal-700 border border-teal-100">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Enrollment Trend Over Time</h3>
              <p className="text-xs text-slate-500">Monthly breakdown of new participant enrollments</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md border border-slate-200">
            Last 6 Months
          </span>
        </div>

        {/* Recharts Bar Chart Integration */}
        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.enrollmentTrend} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={1} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="emptyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#e2e8f0" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="period"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomChartTooltip />} cursor={{ fill: "rgba(241, 245, 249, 0.6)" }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={54}>
                {stats.enrollmentTrend.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.count > 0 ? "url(#tealGradient)" : "url(#emptyGradient)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main Section 2: Side-by-Side Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Program Status Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-100">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Program Status Breakdown</h3>
              <p className="text-xs text-slate-500">Distribution by operational state</p>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            {/* Active Programs */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-emerald-700 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Active Programs</span>
                </span>
                <span className="text-slate-900">{stats.programStatusCounts.active}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stats.totalPrograms > 0 ? (stats.programStatusCounts.active / stats.totalPrograms) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Upcoming Programs */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-indigo-700 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span>Upcoming Programs</span>
                </span>
                <span className="text-slate-900">{stats.programStatusCounts.upcoming}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stats.totalPrograms > 0 ? (stats.programStatusCounts.upcoming / stats.totalPrograms) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Completed Programs */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-teal-700 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500" />
                  <span>Completed Programs</span>
                </span>
                <span className="text-slate-900">{stats.programStatusCounts.completed}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-teal-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stats.totalPrograms > 0 ? (stats.programStatusCounts.completed / stats.totalPrograms) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Cancelled Programs */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-slate-500 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>Cancelled Programs</span>
                </span>
                <span className="text-slate-900">{stats.programStatusCounts.cancelled}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-slate-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stats.totalPrograms > 0 ? (stats.programStatusCounts.cancelled / stats.totalPrograms) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Enrollment Status Funnel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-teal-50 rounded-lg text-teal-700 border border-teal-100">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Enrollment Status Breakdown</h3>
                <p className="text-xs text-slate-500">Counts across Registered, Active, and Finished</p>
              </div>
            </div>

            <Link
              href="/programs"
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center space-x-1"
            >
              <span>Programs</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Registered</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{stats.statusCounts.registered}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Initial signups</p>
            </div>

            <div className="p-3.5 bg-teal-50/60 border border-teal-100 rounded-xl text-center">
              <p className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider">Active</p>
              <p className="text-2xl font-black text-teal-900 mt-1">{stats.statusCounts.active}</p>
              <p className="text-[10px] text-teal-700 mt-0.5">Currently studying</p>
            </div>

            <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl text-center">
              <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Completed</p>
              <p className="text-2xl font-black text-emerald-900 mt-1">{stats.statusCounts.completed}</p>
              <p className="text-[10px] text-emerald-700 mt-0.5">Successfully finished</p>
            </div>

            <div className="p-3.5 bg-amber-50/60 border border-amber-100 rounded-xl text-center">
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Dropped</p>
              <p className="text-2xl font-black text-amber-900 mt-1">{stats.statusCounts.dropped}</p>
              <p className="text-[10px] text-amber-700 mt-0.5">Incomplete / Withdrawn</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
