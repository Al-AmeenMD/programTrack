"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  BookOpen,
  PieChart,
  Activity,
  UserCheck,
} from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";

type ProgramReportData = {
  program: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    start_date: string | null;
    end_date: string | null;
  };
  totalEnrollments: number;
  statusCounts: {
    registered: number;
    active: number;
    completed: number;
    dropped: number;
  };
  funnel: {
    totalRegistered: number;
    currentlyActive: number;
    completed: number;
    dropped: number;
    completionRate: number;
  };
  courseBreakdown: Array<{ id: string; name: string; count: number }>;
  genderCounts: {
    male: number;
    female: number;
    other: number;
    unspecified: number;
  };
};

export function ProgramReportView({ programId }: { programId: string }) {
  const [report, setReport] = useState<ProgramReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/programs/${programId}/reports`);
      if (!res.ok) {
        throw new Error("Failed to load program report");
      }
      const data = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err.message || "Error loading program report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [programId]);

  const handleExportCsv = () => {
    if (!report) return;

    const rows: Record<string, any>[] = [];

    // Summary Section
    rows.push({
      Category: "Program Summary",
      Item: "Program Name",
      Count: report.program.name,
      Percentage: "N/A",
    });
    rows.push({
      Category: "Program Summary",
      Item: "Total Enrollments",
      Count: report.totalEnrollments,
      Percentage: "100%",
    });
    rows.push({
      Category: "Program Summary",
      Item: "Completion Rate",
      Count: `${report.funnel.completionRate}%`,
      Percentage: "N/A",
    });

    // Status Breakdown
    rows.push({
      Category: "Enrollment Status",
      Item: "Registered",
      Count: report.statusCounts.registered,
      Percentage: report.totalEnrollments > 0 ? `${Math.round((report.statusCounts.registered / report.totalEnrollments) * 100)}%` : "0%",
    });
    rows.push({
      Category: "Enrollment Status",
      Item: "Active",
      Count: report.statusCounts.active,
      Percentage: report.totalEnrollments > 0 ? `${Math.round((report.statusCounts.active / report.totalEnrollments) * 100)}%` : "0%",
    });
    rows.push({
      Category: "Enrollment Status",
      Item: "Completed",
      Count: report.statusCounts.completed,
      Percentage: report.totalEnrollments > 0 ? `${Math.round((report.statusCounts.completed / report.totalEnrollments) * 100)}%` : "0%",
    });
    rows.push({
      Category: "Enrollment Status",
      Item: "Dropped",
      Count: report.statusCounts.dropped,
      Percentage: report.totalEnrollments > 0 ? `${Math.round((report.statusCounts.dropped / report.totalEnrollments) * 100)}%` : "0%",
    });

    // Course Breakdown
    report.courseBreakdown.forEach((c) => {
      rows.push({
        Category: "Course / Track Distribution",
        Item: c.name,
        Count: c.count,
        Percentage: report.totalEnrollments > 0 ? `${Math.round((c.count / report.totalEnrollments) * 100)}%` : "0%",
      });
    });

    // Gender Breakdown
    rows.push({
      Category: "Demographics (Gender)",
      Item: "Female",
      Count: report.genderCounts.female,
      Percentage: report.totalEnrollments > 0 ? `${Math.round((report.genderCounts.female / report.totalEnrollments) * 100)}%` : "0%",
    });
    rows.push({
      Category: "Demographics (Gender)",
      Item: "Male",
      Count: report.genderCounts.male,
      Percentage: report.totalEnrollments > 0 ? `${Math.round((report.genderCounts.male / report.totalEnrollments) * 100)}%` : "0%",
    });
    rows.push({
      Category: "Demographics (Gender)",
      Item: "Other / Unspecified",
      Count: report.genderCounts.other + report.genderCounts.unspecified,
      Percentage: report.totalEnrollments > 0 ? `${Math.round(((report.genderCounts.other + report.genderCounts.unspecified) / report.totalEnrollments) * 100)}%` : "0%",
    });

    const today = new Date().toISOString().split("T")[0];
    const safeName = report.program.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    exportToCsv(`programtrack_report_${safeName}_${today}.csv`, rows);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Generating program report...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3 max-w-lg mx-auto my-8">
        <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
        <p className="text-sm font-semibold text-rose-900">{error || "Failed to load program report"}</p>
        <button
          onClick={fetchReport}
          className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const maxCourseCount = Math.max(...report.courseBreakdown.map((c) => c.count), 1);

  return (
    <div className="space-y-6 pt-2">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Program Performance & Analytics</h3>
          <p className="text-xs text-slate-500">
            Comprehensive breakdown of student funnel, track assignments, and gender demographics.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="inline-flex items-center space-x-2 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-xs transition shadow-xs shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download Program Report CSV</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Enrolled
          </span>
          <p className="text-2xl font-bold text-slate-900">{report.totalEnrollments}</p>
          <p className="text-xs text-slate-500">All registered participants</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
            Currently Active
          </span>
          <p className="text-2xl font-bold text-emerald-800">{report.statusCounts.active}</p>
          <p className="text-xs text-slate-500">In training</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-teal-600 uppercase tracking-wider">
            Completed
          </span>
          <p className="text-2xl font-bold text-teal-800">{report.statusCounts.completed}</p>
          <p className="text-xs text-slate-500">Finished training</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider">
            Completion Rate
          </span>
          <p className="text-2xl font-bold text-teal-700">{report.funnel.completionRate}%</p>
          <p className="text-xs text-slate-500">Out of finished students</p>
        </div>
      </div>

      {/* Main Grid: Funnel & Course Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Enrollment Status Funnel */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-teal-600" />
            <h4 className="font-bold text-slate-900 text-sm">Enrollment Status Funnel</h4>
          </div>

          <div className="space-y-4">
            {/* Registered */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Registered</span>
                <span>{report.statusCounts.registered}</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${report.totalEnrollments > 0 ? (report.statusCounts.registered / report.totalEnrollments) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Active */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Active</span>
                <span>{report.statusCounts.active}</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${report.totalEnrollments > 0 ? (report.statusCounts.active / report.totalEnrollments) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Completed */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Completed</span>
                <span>{report.statusCounts.completed}</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-600 rounded-full"
                  style={{
                    width: `${report.totalEnrollments > 0 ? (report.statusCounts.completed / report.totalEnrollments) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Dropped */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Dropped</span>
                <span>{report.statusCounts.dropped}</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${report.totalEnrollments > 0 ? (report.statusCounts.dropped / report.totalEnrollments) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Course / Track Participant Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-teal-600" />
            <h4 className="font-bold text-slate-900 text-sm">Course / Track Distribution</h4>
          </div>

          {report.courseBreakdown.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">No courses configured for this program.</p>
          ) : (
            <div className="space-y-4">
              {report.courseBreakdown.map((course) => {
                const percentage =
                  report.totalEnrollments > 0
                    ? Math.round((course.count / report.totalEnrollments) * 100)
                    : 0;

                return (
                  <div key={course.id}>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                      <span className="truncate pr-2">{course.name}</span>
                      <span className="shrink-0">{course.count} ({percentage}%)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-600 rounded-full"
                        style={{
                          width: `${maxCourseCount > 0 ? (course.count / maxCourseCount) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Demographics Breakdown (Gender Split) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-teal-600" />
          <h4 className="font-bold text-slate-900 text-sm">Demographic Breakdown (Gender)</h4>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Female</span>
            <p className="text-xl font-bold text-slate-900">{report.genderCounts.female}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Male</span>
            <p className="text-xl font-bold text-slate-900">{report.genderCounts.male}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Other</span>
            <p className="text-xl font-bold text-slate-900">{report.genderCounts.other}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Unspecified</span>
            <p className="text-xl font-bold text-slate-900">{report.genderCounts.unspecified}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
