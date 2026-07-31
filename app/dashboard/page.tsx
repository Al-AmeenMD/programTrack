"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  Users,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  ArrowUpRight,
  PieChart,
  Activity,
} from "lucide-react";
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

  const maxTrendCount = Math.max(...stats.enrollmentTrend.map((t) => t.count), 1);

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

      {/* Top Key Performance Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Active Participants */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Participants
            </p>
            <p className="text-3xl font-extrabold text-slate-900">{stats.totalActiveParticipants}</p>
            <p className="text-xs text-slate-500">Currently enrolled & active</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Active Programs */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Programs
            </p>
            <p className="text-3xl font-extrabold text-slate-900">{stats.programStatusCounts.active}</p>
            <p className="text-xs text-slate-500">Out of {stats.totalPrograms} total programs</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3: Overall Completion Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Completion Rate
            </p>
            <p className="text-3xl font-extrabold text-teal-700">{stats.completionRate}%</p>
            <p className="text-xs text-slate-500">{stats.statusCounts.completed} completed enrollments</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4: Dropout Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Dropout Rate
            </p>
            <p className="text-3xl font-extrabold text-slate-700">{stats.dropoutRate}%</p>
            <p className="text-xs text-slate-500">{stats.statusCounts.dropped} dropped enrollments</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Charts & Data Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Enrollment Trend Over Time */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-teal-50 rounded-lg text-teal-700 border border-teal-100">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Enrollment Trend Over Time</h3>
                <p className="text-xs text-slate-500">New participant enrollments registered per month</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-400">Last 6 Months</span>
          </div>

          {/* Bar Chart Visualization */}
          <div className="pt-4 pb-2">
            <div className="h-48 flex items-end justify-between gap-2 sm:gap-4 border-b border-slate-200 pb-2">
              {stats.enrollmentTrend.map((item, idx) => {
                const heightPercent = maxTrendCount > 0 ? (item.count / maxTrendCount) * 100 : 0;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center group relative">
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition absolute -top-8 bg-slate-900 text-white text-[11px] font-semibold py-1 px-2 rounded shadow-md pointer-events-none whitespace-nowrap z-10">
                      {item.count} enrollment{item.count === 1 ? "" : "s"}
                    </div>

                    <div className="w-full bg-slate-100 rounded-t-md h-full flex items-end overflow-hidden">
                      <div
                        style={{ height: `${Math.max(heightPercent, 6)}%` }}
                        className="w-full bg-teal-600 group-hover:bg-teal-500 transition rounded-t-md relative"
                      >
                        {item.count > 0 && (
                          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-bold text-slate-700">
                            {item.count}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 mt-2 truncate w-full text-center">
                      {item.period}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Program Status Distribution */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-700 border border-slate-200">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Program Status Breakdown</h3>
              <p className="text-xs text-slate-500">Distribution by cohort operational state</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Active Programs Bar */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>Active Programs</span>
                </span>
                <span>{stats.programStatusCounts.active}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${stats.totalPrograms > 0 ? (stats.programStatusCounts.active / stats.totalPrograms) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Upcoming Programs Bar */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span>Upcoming Programs</span>
                </span>
                <span>{stats.programStatusCounts.upcoming}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${stats.totalPrograms > 0 ? (stats.programStatusCounts.upcoming / stats.totalPrograms) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Completed Programs Bar */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
                  <span>Completed Programs</span>
                </span>
                <span>{stats.programStatusCounts.completed}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-600 rounded-full"
                  style={{
                    width: `${stats.totalPrograms > 0 ? (stats.programStatusCounts.completed / stats.totalPrograms) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Cancelled Programs Bar */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  <span>Cancelled Programs</span>
                </span>
                <span>{stats.programStatusCounts.cancelled}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-400 rounded-full"
                  style={{
                    width: `${stats.totalPrograms > 0 ? (stats.programStatusCounts.cancelled / stats.totalPrograms) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enrollment Status Funnel Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-teal-50 rounded-lg text-teal-700 border border-teal-100">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Enrollment Status Breakdown</h3>
              <p className="text-xs text-slate-500">
                Detailed counts across Registered, Active, Completed, and Dropped statuses
              </p>
            </div>
          </div>
          <Link
            href="/programs"
            className="inline-flex items-center space-x-1 text-xs font-semibold text-teal-700 hover:text-teal-800 transition"
          >
            <span>Manage Programs</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          {/* Registered */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase">Registered</span>
            <p className="text-2xl font-bold text-slate-900">{stats.statusCounts.registered}</p>
            <p className="text-[11px] text-slate-500">Initial signups</p>
          </div>

          {/* Active */}
          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/60 text-center space-y-1">
            <span className="text-xs font-semibold text-emerald-700 uppercase">Active</span>
            <p className="text-2xl font-bold text-emerald-800">{stats.statusCounts.active}</p>
            <p className="text-[11px] text-emerald-600">Currently studying</p>
          </div>

          {/* Completed */}
          <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-200/60 text-center space-y-1">
            <span className="text-xs font-semibold text-teal-700 uppercase">Completed</span>
            <p className="text-2xl font-bold text-teal-800">{stats.statusCounts.completed}</p>
            <p className="text-[11px] text-teal-600">Successfully finished</p>
          </div>

          {/* Dropped */}
          <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/60 text-center space-y-1">
            <span className="text-xs font-semibold text-amber-700 uppercase">Dropped</span>
            <p className="text-2xl font-bold text-amber-800">{stats.statusCounts.dropped}</p>
            <p className="text-[11px] text-amber-600">Withdrawn / Incomplete</p>
          </div>
        </div>
      </div>
    </div>
  );
}
