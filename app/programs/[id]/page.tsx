"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Calendar,
  FileText,
  Upload,
  UserPlus,
  Trash2,
  Edit,
  Ban,
  Plus,
  BookOpen,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Eye,
  CheckCheck,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal, ConfirmDialog } from "@/components/ui/Dialog";
import { BulkUploadModal } from "@/components/BulkUploadModal";
import { IntakeFormModal } from "@/components/IntakeFormModal";
import { useAuth } from "@/components/AuthProvider";

type CourseItem = {
  id: string;
  program_id: string;
  name: string;
  created_at: string;
};

type Enrollment = {
  id: string;
  participant_id: string;
  program_id: string;
  course_id?: string | null;
  status: string;
  created_at: string;
  participant: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  };
  course?: {
    id: string;
    name: string;
  } | null;
};

type SessionItem = {
  id: string;
  title: string;
  session_date: string;
  is_active: boolean;
};

type FormFieldItem = {
  id?: string;
  label: string;
  field_type: "text" | "number" | "select" | "date" | "checkbox";
  required: boolean;
  options?: string[];
};

type FormTemplateData = {
  id: string;
  name: string;
  fields: FormFieldItem[];
};

type ProgramDetail = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export default function ProgramDetailPage({ params }: RouteContext) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, assignedProgramIds } = useAuth();

  const isAdmin = user?.role === "admin";
  const isAssigned = isAdmin || (assignedProgramIds || []).includes(id);

  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [formTemplate, setFormTemplate] = useState<FormTemplateData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab State
  const initialTab = (searchParams.get("tab") as "enrollments" | "courses" | "sessions" | "form-template") || "enrollments";
  const [activeTab, setActiveTab] = useState<"enrollments" | "courses" | "sessions" | "form-template">(initialTab);

  // Edit Program Modal
  const [isEditProgramOpen, setIsEditProgramOpen] = useState(false);
  const [editProgramForm, setEditProgramForm] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    status: "active",
  });
  const [editProgramLoading, setEditProgramLoading] = useState(false);

  // Cancel Program Modal
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Course Modal
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
  const [courseNameInput, setCourseNameInput] = useState("");
  const [addCourseLoading, setAddCourseLoading] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);

  // Enroll Participant Modal
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    gender: "",
    course_id: "",
  });
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // Bulk Upload Modal
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  // Change Course Modal
  const [changeCourseTarget, setChangeCourseTarget] = useState<Enrollment | null>(null);
  const [changeCourseSelectedId, setChangeCourseSelectedId] = useState("");
  const [changeCourseLoading, setChangeCourseLoading] = useState(false);

  // Update Enrollment Status State
  const [updateEnrollmentTarget, setUpdateEnrollmentTarget] = useState<Enrollment | null>(null);
  const [newStatus, setNewStatus] = useState("registered");
  const [updateStatusLoading, setUpdateStatusLoading] = useState(false);

  // Drop Enrollment Confirmation State
  const [dropTarget, setDropTarget] = useState<Enrollment | null>(null);
  const [dropLoading, setDropLoading] = useState(false);

  // Intake Form Modal (Fill out / View response)
  const [intakeModalTarget, setIntakeModalTarget] = useState<{ enrollmentId: string; participantName: string } | null>(null);

  // --- SESSIONS TAB STATE ---
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [addSessionForm, setAddSessionForm] = useState({ title: "", session_date: "" });
  const [addSessionLoading, setAddSessionLoading] = useState(false);

  const [editSessionTarget, setEditSessionTarget] = useState<SessionItem | null>(null);
  const [editSessionForm, setEditSessionForm] = useState({ title: "", session_date: "", is_active: true });
  const [editSessionLoading, setEditSessionLoading] = useState(false);

  const [deactivateSessionTarget, setDeactivateSessionTarget] = useState<SessionItem | null>(null);
  const [deactivateSessionLoading, setDeactivateSessionLoading] = useState(false);

  // --- INTAKE FORM BUILDER STATE (ADMIN) ---
  const [builderTemplateName, setBuilderTemplateName] = useState("");
  const [builderFields, setBuilderFields] = useState<FormFieldItem[]>([]);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [fieldInput, setFieldInput] = useState<{
    label: string;
    field_type: "text" | "number" | "select" | "date" | "checkbox";
    required: boolean;
    optionsString: string;
  }>({
    label: "",
    field_type: "text",
    required: false,
    optionsString: "",
  });

  const [templateSaveLoading, setTemplateSaveLoading] = useState(false);
  const [templateWarning, setTemplateWarning] = useState<string | null>(null);
  const [templateSuccess, setTemplateSuccess] = useState<string | null>(null);

  const fetchProgramData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const progRes = await fetch(`/api/programs/${id}`);
      const progJson = await progRes.json();
      if (!progRes.ok) throw new Error(progJson.error || "Failed to load program");
      setProgram(progJson.data);
      setEditProgramForm({
        name: progJson.data.name || "",
        description: progJson.data.description || "",
        start_date: progJson.data.start_date ? new Date(progJson.data.start_date).toISOString().split("T")[0] : "",
        end_date: progJson.data.end_date ? new Date(progJson.data.end_date).toISOString().split("T")[0] : "",
        status: progJson.data.status || "active",
      });

      const courseRes = await fetch(`/api/programs/${id}/courses`);
      const courseJson = await courseRes.json();
      if (courseRes.ok) setCourses(courseJson.data || []);

      const enrollRes = await fetch(`/api/programs/${id}/enrollments`);
      const enrollJson = await enrollRes.json();
      if (enrollRes.ok) setEnrollments(enrollJson.data || []);

      const sessionRes = await fetch(`/api/programs/${id}/sessions?include_inactive=true`);
      const sessionJson = await sessionRes.json();
      if (sessionRes.ok) setSessions(sessionJson.data || []);

      const formRes = await fetch(`/api/programs/${id}/form-template`);
      const formJson = await formRes.json();
      if (formRes.ok && formJson.data) {
        setFormTemplate(formJson.data);
        setBuilderTemplateName(formJson.data.name || "Program Intake Form");
        setBuilderFields((formJson.data.fields as FormFieldItem[]) || []);
      } else {
        setFormTemplate(null);
        setBuilderTemplateName("Program Intake Form");
        setBuilderFields([]);
      }
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to load program details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgramData();
  }, [id]);

  // Program Level Actions
  const handleEditProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditProgramLoading(true);
    try {
      const res = await fetch(`/api/programs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editProgramForm.name,
          description: editProgramForm.description || null,
          start_date: editProgramForm.start_date || null,
          end_date: editProgramForm.end_date || null,
          status: editProgramForm.status,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update program");
      }
      setIsEditProgramOpen(false);
      await fetchProgramData(true);
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to update program");
    } finally {
      setEditProgramLoading(false);
    }
  };

  const handleCancelProgramConfirm = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/programs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to cancel program");
      }
      setIsCancelOpen(false);
      await fetchProgramData(true);
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to cancel program");
    } finally {
      setCancelLoading(false);
    }
  };

  // Add Course
  const handleAddCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddCourseLoading(true);
    setCourseError(null);
    try {
      const res = await fetch(`/api/programs/${id}/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: courseNameInput }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add course");
      setIsAddCourseOpen(false);
      setCourseNameInput("");
      await fetchProgramData(true);
    } catch (err: unknown) {
      setCourseError((err as { message?: string }).message || "Failed to add course");
    } finally {
      setAddCourseLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId: string, courseName: string) => {
    if (!confirm(`Are you sure you want to delete course "${courseName}"?`)) return;
    try {
      const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to delete course");
      }
      await fetchProgramData(true);
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to delete course");
    }
  };

  // Enroll Participant
  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollLoading(true);
    setEnrollError(null);
    try {
      const res = await fetch(`/api/programs/${id}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...enrollForm,
          course_id: enrollForm.course_id || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to enroll participant");
      setIsEnrollModalOpen(false);
      setEnrollForm({ full_name: "", email: "", phone: "", gender: "", course_id: "" });
      await fetchProgramData(true);
    } catch (err: unknown) {
      setEnrollError((err as { message?: string }).message || "Failed to enroll participant");
    } finally {
      setEnrollLoading(false);
    }
  };

  // Change Course Action
  const handleChangeCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeCourseTarget) return;
    setChangeCourseLoading(true);
    try {
      const res = await fetch(`/api/enrollments/${changeCourseTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: changeCourseSelectedId || null }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update enrollment course");
      }
      setChangeCourseTarget(null);
      await fetchProgramData(true);
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to update course");
    } finally {
      setChangeCourseLoading(false);
    }
  };

  // Update Enrollment Status
  const handleUpdateStatusConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateEnrollmentTarget) return;
    setUpdateStatusLoading(true);
    try {
      const res = await fetch(`/api/enrollments/${updateEnrollmentTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update enrollment status");
      }
      setUpdateEnrollmentTarget(null);
      await fetchProgramData(true);
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to update status");
    } finally {
      setUpdateStatusLoading(false);
    }
  };

  // Drop Enrollment
  const handleDropEnrollmentConfirm = async () => {
    if (!dropTarget) return;
    setDropLoading(true);
    try {
      const res = await fetch(`/api/enrollments/${dropTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to drop enrollment");
      }
      setDropTarget(null);
      await fetchProgramData(true);
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to drop enrollment");
    } finally {
      setDropLoading(false);
    }
  };

  // --- SESSIONS HANDLERS ---
  const handleAddSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSessionLoading(true);
    try {
      const res = await fetch(`/api/programs/${id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addSessionForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create session");
      setIsAddSessionOpen(false);
      setAddSessionForm({ title: "", session_date: "" });
      await fetchProgramData(true);
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to create session");
    } finally {
      setAddSessionLoading(false);
    }
  };

  const handleEditSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSessionTarget) return;
    setEditSessionLoading(true);
    try {
      const res = await fetch(`/api/sessions/${editSessionTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editSessionForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update session");
      setEditSessionTarget(null);
      await fetchProgramData(true);
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to update session");
    } finally {
      setEditSessionLoading(false);
    }
  };

  const handleDeactivateSessionConfirm = async () => {
    if (!deactivateSessionTarget) return;
    setDeactivateSessionLoading(true);
    try {
      const res = await fetch(`/api/sessions/${deactivateSessionTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to deactivate session");
      setDeactivateSessionTarget(null);
      await fetchProgramData(true);
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to deactivate session");
    } finally {
      setDeactivateSessionLoading(false);
    }
  };

  // --- INTAKE FORM BUILDER HANDLERS ---
  const handleSaveFieldInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldInput.label.trim()) return;

    const parsedOptions =
      fieldInput.field_type === "select"
        ? fieldInput.optionsString
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const newField: FormFieldItem = {
      label: fieldInput.label.trim(),
      field_type: fieldInput.field_type,
      required: fieldInput.required,
      options: parsedOptions,
    };

    if (editingFieldIndex !== null) {
      setBuilderFields((prev) => prev.map((f, i) => (i === editingFieldIndex ? newField : f)));
    } else {
      setBuilderFields((prev) => [...prev, newField]);
    }

    setIsFieldModalOpen(false);
    setEditingFieldIndex(null);
    setFieldInput({ label: "", field_type: "text", required: false, optionsString: "" });
  };

  const handleRemoveField = (index: number) => {
    setBuilderFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (builderFields.length === 0) {
      alert("Please add at least one field to the intake form template.");
      return;
    }

    setTemplateSaveLoading(true);
    setTemplateWarning(null);
    setTemplateSuccess(null);

    try {
      const isPatch = Boolean(formTemplate);
      const url = `/api/programs/${id}/form-template`;
      const method = isPatch ? "PATCH" : "POST";
      const payload = {
        name: builderTemplateName || "Program Intake Form",
        fields: builderFields,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save intake form template");

      if (json.warning) {
        setTemplateWarning(json.warning);
      } else {
        setTemplateSuccess("Intake form template saved successfully!");
      }

      await fetchProgramData(true);
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "Failed to save template");
    } finally {
      setTemplateSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
        <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
        <span>Loading program details...</span>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="p-12 text-center text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-md">
        <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-2" />
        <span className="font-bold text-sm block mb-1">Program Not Found</span>
        <span>The requested program does not exist or was deleted.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Navigation */}
      <div>
        <Link
          href="/programs"
          className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Programs</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {program.name}
              </h1>
              <StatusBadge status={program.status} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {program.description || "No description provided."}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {isAdmin && (
              <>
                <button
                  onClick={() => setIsEditProgramOpen(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-md transition flex items-center space-x-1.5"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Program</span>
                </button>
                {program.status !== "cancelled" && (
                  <button
                    onClick={() => setIsCancelOpen(true)}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium rounded-md transition flex items-center space-x-1.5 border border-rose-200"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Cancel Program</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Program Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] text-slate-500 font-medium flex items-center space-x-1">
            <Users className="w-3.5 h-3.5 text-teal-700" />
            <span>Enrollments</span>
          </span>
          <p className="text-xl font-bold text-slate-900">{enrollments.length}</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] text-slate-500 font-medium flex items-center space-x-1">
            <BookOpen className="w-3.5 h-3.5 text-teal-700" />
            <span>Courses / Tracks</span>
          </span>
          <p className="text-xl font-bold text-slate-900">{courses.length}</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] text-slate-500 font-medium flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5 text-teal-700" />
            <span>Sessions</span>
          </span>
          <p className="text-xl font-bold text-slate-900">{sessions.length}</p>
        </div>

{/* INTAKE FORM STAT CARD — hidden until intake form feature is enabled
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] text-slate-500 font-medium flex items-center space-x-1">
            <FileText className="w-3.5 h-3.5 text-teal-700" />
            <span>Intake Form</span>
          </span>
          <p className="text-xs font-semibold text-slate-800">
            {formTemplate ? formTemplate.name : "Not Configured"}
          </p>
        </div>
        */}
      </div>

      {/* TABS NAVIGATION */}
      <div className="border-b border-slate-200 flex space-x-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("enrollments")}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === "enrollments"
              ? "border-teal-700 text-teal-800"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Enrollments ({enrollments.length})
        </button>

        <button
          onClick={() => setActiveTab("courses")}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === "courses"
              ? "border-teal-700 text-teal-800"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Courses / Tracks ({courses.length})
        </button>

        <button
          onClick={() => setActiveTab("sessions")}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === "sessions"
              ? "border-teal-700 text-teal-800"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Sessions ({sessions.length})
        </button>

{/* INTAKE FORM TEMPLATE TAB — hidden until intake form feature is enabled
        <button
          onClick={() => setActiveTab("form-template")}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === "form-template"
              ? "border-teal-700 text-teal-800"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Intake Form Template
        </button>
        */}
      </div>

      {/* TAB 1: ENROLLMENTS */}
      {activeTab === "enrollments" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Enrolled Participants
            </h3>

            {isAssigned && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsBulkUploadOpen(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-md transition flex items-center space-x-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bulk Upload CSV</span>
                </button>

                <button
                  onClick={() => setIsEnrollModalOpen(true)}
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md transition flex items-center space-x-1.5 shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Enroll Participant</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            {enrollments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No participants enrolled in this program yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Participant Name</th>
                      <th className="py-2.5 px-4">Email</th>
                      <th className="py-2.5 px-4">Phone</th>
                      <th className="py-2.5 px-4">Course / Track</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Enrolled Date</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {enrollments.map((en) => (
                      <tr key={en.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          <Link
                            href={`/participants/${en.participant.id}`}
                            className="hover:text-teal-700 hover:underline"
                          >
                            {en.participant.full_name}
                          </Link>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{en.participant.email || "—"}</td>
                        <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">
                          {en.participant.phone || "—"}
                        </td>
                        <td className="py-2.5 px-4">
                          {en.course?.name ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-medium text-[11px]">
                              {en.course.name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <StatusBadge status={en.status} />
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {new Date(en.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-4 text-right space-x-2">
{/* INTAKE FORM BUTTON — hidden until intake form feature is enabled
                          {formTemplate && (
                            <button
                              onClick={() =>
                                setIntakeModalTarget({
                                  enrollmentId: en.id,
                                  participantName: en.participant.full_name,
                                })
                              }
                              className="px-2 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded text-[11px] font-medium transition"
                              title="Fill or View Intake Form Response"
                            >
                              Intake Form
                            </button>
                          )}
                          */}
                          {isAssigned && (
                            <>
                              {courses.length > 0 && (
                                <button
                                  onClick={() => {
                                    setChangeCourseTarget(en);
                                    setChangeCourseSelectedId(en.course?.id || "");
                                  }}
                                  className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded text-[11px] font-medium transition"
                                >
                                  Change Course
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setUpdateEnrollmentTarget(en);
                                  setNewStatus(en.status);
                                }}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition"
                              >
                                Change Status
                              </button>
                              {en.status !== "dropped" && (
                                <button
                                  onClick={() => setDropTarget(en)}
                                  className="p-1 text-slate-400 hover:text-rose-600 inline-block"
                                  title="Drop Enrollment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: COURSES / TRACKS */}
      {activeTab === "courses" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Courses / Tracks
            </h3>

            {isAdmin && (
              <button
                onClick={() => setIsAddCourseOpen(true)}
                className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md transition flex items-center space-x-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Course</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            {courses.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No courses or tracks defined for this program. (All participants enroll directly in the program).
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Course / Track Name</th>
                    <th className="py-2.5 px-4">Created Date</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {courses.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        <Link
                          href={`/programs/${program.id}/courses/${c.id}`}
                          className="hover:text-teal-700 hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteCourse(c.id, c.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 inline-block"
                            title="Delete Course"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SESSIONS UI */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Program Sessions & Attendance
              </h3>
              <p className="text-xs text-slate-500">Attendance records operate at the program level</p>
            </div>

            {isAssigned && (
              <button
                onClick={() => setIsAddSessionOpen(true)}
                className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md transition flex items-center space-x-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Session</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No sessions created for this program yet. Click &quot;+ Add Session&quot; to set up session attendance dates.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Session Title</th>
                    <th className="py-2.5 px-4">Session Date</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        <Link
                          href={`/programs/${program.id}/sessions/${s.id}/attendance`}
                          className="hover:text-teal-700 hover:underline flex items-center space-x-1.5"
                        >
                          <Calendar className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                          <span>{s.title}</span>
                        </Link>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 font-medium">
                        {new Date(s.session_date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                            s.is_active
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-600 border-slate-300"
                          }`}
                        >
                          {s.is_active ? "Active" : "Inactive (Soft-deleted)"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-2">
                        {s.is_active ? (
                          <Link
                            href={`/programs/${program.id}/sessions/${s.id}/attendance`}
                            className="px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded text-[11px] font-medium transition inline-flex items-center space-x-1"
                          >
                            <CheckCheck className="w-3 h-3" />
                            <span>Mark Attendance</span>
                          </Link>
                        ) : (
                          <Link
                            href={`/programs/${program.id}/sessions/${s.id}/attendance`}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-300 rounded text-[11px] font-medium transition inline-flex items-center space-x-1"
                            title="Session is inactive — attendance is read-only"
                          >
                            <CheckCheck className="w-3 h-3" />
                            <span>View Attendance</span>
                          </Link>
                        )}


                        {isAssigned && (
                          <>
                            <button
                              onClick={() => {
                                setEditSessionTarget(s);
                                setEditSessionForm({
                                  title: s.title,
                                  session_date: s.session_date ? new Date(s.session_date).toISOString().split("T")[0] : "",
                                  is_active: s.is_active,
                                });
                              }}
                              className="p-1 text-slate-500 hover:text-teal-700 inline-block"
                              title="Edit Session"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {s.is_active && (
                              <button
                                onClick={() => setDeactivateSessionTarget(s)}
                                className="p-1 text-slate-400 hover:text-rose-600 inline-block"
                                title="Deactivate Session"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: INTAKE FORM TEMPLATE BUILDER & VIEWER */}
      {activeTab === "form-template" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Intake Form Template Builder
              </h3>
              <p className="text-xs text-slate-500">
                {isAdmin
                  ? "Configure custom intake questions collected during participant enrollment"
                  : "Read-only preview of program intake questions"}
              </p>
            </div>
          </div>

          {templateWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{templateWarning}</span>
            </div>
          )}

          {templateSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{templateSuccess}</span>
            </div>
          )}

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 flex-1 max-w-md">
                <label className="font-bold text-slate-700 whitespace-nowrap">Template Name:</label>
                {isAdmin ? (
                  <input
                    type="text"
                    value={builderTemplateName}
                    onChange={(e) => setBuilderTemplateName(e.target.value)}
                    placeholder="e.g. IDEAS Cohort 2 Intake Form"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  />
                ) : (
                  <span className="font-bold text-slate-900">{formTemplate?.name || "Program Intake Form"}</span>
                )}
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingFieldIndex(null);
                    setFieldInput({ label: "", field_type: "text", required: false, optionsString: "" });
                    setIsFieldModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs rounded-md shadow-xs transition flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Field</span>
                </button>
              )}
            </div>

            {builderFields.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50 rounded border border-slate-200">
                No intake form fields configured yet. Click &quot;Add Field&quot; to build your form questions.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4">#</th>
                        <th className="py-2.5 px-4">Field Question / Label</th>
                        <th className="py-2.5 px-4">Field Type</th>
                        <th className="py-2.5 px-4">Required</th>
                        <th className="py-2.5 px-4">Options (Select Type)</th>
                        {isAdmin && <th className="py-2.5 px-4 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {builderFields.map((field, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">{field.label}</td>
                          <td className="py-2.5 px-4 text-slate-600 capitalize font-mono text-[11px]">
                            {field.field_type}
                          </td>
                          <td className="py-2.5 px-4">
                            {field.required ? (
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold">
                                Required
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded text-[10px]">
                                Optional
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">
                            {field.options && field.options.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {field.options.map((opt, oIdx) => (
                                  <span
                                    key={oIdx}
                                    className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 text-[10px]"
                                  >
                                    {opt}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-2.5 px-4 text-right space-x-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFieldIndex(idx);
                                  setFieldInput({
                                    label: field.label,
                                    field_type: field.field_type as "text" | "number" | "select" | "date" | "checkbox",
                                    required: field.required,
                                    optionsString: (field.options || []).join(", "),
                                  });
                                  setIsFieldModalOpen(true);
                                }}
                                className="p-1 text-slate-500 hover:text-teal-700 inline-block"
                                title="Edit Field"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveField(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 inline-block"
                                title="Delete Field"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isAdmin && (
                  <div className="flex justify-end pt-3">
                    <button
                      type="button"
                      onClick={handleSaveTemplateSubmit}
                      disabled={templateSaveLoading}
                      className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs rounded-md shadow-xs transition disabled:opacity-50 flex items-center space-x-2"
                    >
                      {templateSaveLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{formTemplate ? "Save Template Changes" : "Create Intake Form Template"}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* INTAKE FORM MODAL (FILL / VIEW) */}
      <IntakeFormModal
        isOpen={Boolean(intakeModalTarget)}
        onClose={() => setIntakeModalTarget(null)}
        enrollmentId={intakeModalTarget?.enrollmentId || null}
        participantName={intakeModalTarget?.participantName || ""}
        programId={id}
      />

      {/* SESSIONS: ADD SESSION MODAL */}
      <Modal
        isOpen={isAddSessionOpen}
        onClose={() => setIsAddSessionOpen(false)}
        title="Add New Program Session"
      >
        <form onSubmit={handleAddSessionSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Session Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={addSessionForm.title}
              onChange={(e) => setAddSessionForm({ ...addSessionForm, title: e.target.value })}
              placeholder="e.g. Session 1: Orientation & Foundations"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Session Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={addSessionForm.session_date}
              onChange={(e) => setAddSessionForm({ ...addSessionForm, session_date: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddSessionOpen(false)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addSessionLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {addSessionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Create Session</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* SESSIONS: EDIT SESSION MODAL */}
      <Modal
        isOpen={Boolean(editSessionTarget)}
        onClose={() => setEditSessionTarget(null)}
        title="Edit Session Details"
      >
        <form onSubmit={handleEditSessionSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Session Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editSessionForm.title}
              onChange={(e) => setEditSessionForm({ ...editSessionForm, title: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Session Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={editSessionForm.session_date}
              onChange={(e) => setEditSessionForm({ ...editSessionForm, session_date: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Active Status</label>
            <select
              value={editSessionForm.is_active ? "active" : "inactive"}
              onChange={(e) => setEditSessionForm({ ...editSessionForm, is_active: e.target.value === "active" })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive (Soft-deleted)</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditSessionTarget(null)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSessionLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {editSessionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* SESSIONS: DEACTIVATE SESSION CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(deactivateSessionTarget)}
        onClose={() => setDeactivateSessionTarget(null)}
        onConfirm={handleDeactivateSessionConfirm}
        title="Deactivate Session"
        description={`Are you sure you want to deactivate session "${deactivateSessionTarget?.title}"? Its status will be updated to inactive.`}
        isLoading={deactivateSessionLoading}
        confirmLabel="Deactivate Session"
      />

      {/* INTAKE FORM BUILDER: ADD / EDIT FIELD MODAL */}
      <Modal
        isOpen={isFieldModalOpen}
        onClose={() => setIsFieldModalOpen(false)}
        title={editingFieldIndex !== null ? "Edit Intake Form Field" : "Add Intake Form Field"}
      >
        <form onSubmit={handleSaveFieldInput} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Field Question / Label <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fieldInput.label}
              onChange={(e) => setFieldInput({ ...fieldInput, label: e.target.value })}
              placeholder="e.g. Highest Educational Qualification"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Input Field Type</label>
            <select
              value={fieldInput.field_type}
              onChange={(e) =>
                setFieldInput({
                  ...fieldInput,
                  field_type: e.target.value as "text" | "number" | "select" | "date" | "checkbox",
                })
              }
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 font-mono"
            >
              <option value="text">text (Single Line Text)</option>
              <option value="number">number (Numeric Input)</option>
              <option value="select">select (Dropdown Options)</option>
              <option value="date">date (Date Picker)</option>
              <option value="checkbox">checkbox (Yes / No Checkbox)</option>
            </select>
          </div>

          {fieldInput.field_type === "select" && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dropdown Options <span className="text-slate-400 font-normal">(comma separated)</span>
              </label>
              <input
                type="text"
                required
                value={fieldInput.optionsString}
                onChange={(e) => setFieldInput({ ...fieldInput, optionsString: e.target.value })}
                placeholder="Option 1, Option 2, Option 3"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          )}

          <div className="pt-1">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fieldInput.required}
                onChange={(e) => setFieldInput({ ...fieldInput, required: e.target.checked })}
                className="w-4 h-4 text-teal-700 rounded border-slate-300 focus:ring-teal-700/20"
              />
              <span className="font-semibold text-slate-800">Required Field (Enforce Answer)</span>
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFieldModalOpen(false)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition"
            >
              Save Field
            </button>
          </div>
        </form>
      </Modal>

      {/* EXISTING MODALS */}
      {/* Edit Program Modal */}
      <Modal
        isOpen={isEditProgramOpen}
        onClose={() => setIsEditProgramOpen(false)}
        title="Edit Program Details"
      >
        <form onSubmit={handleEditProgramSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Program Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editProgramForm.name}
              onChange={(e) => setEditProgramForm({ ...editProgramForm, name: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={editProgramForm.description}
              onChange={(e) => setEditProgramForm({ ...editProgramForm, description: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={editProgramForm.start_date}
                onChange={(e) => setEditProgramForm({ ...editProgramForm, start_date: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={editProgramForm.end_date}
                onChange={(e) => setEditProgramForm({ ...editProgramForm, end_date: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
            <select
              value={editProgramForm.status}
              onChange={(e) => setEditProgramForm({ ...editProgramForm, status: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditProgramOpen(false)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editProgramLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {editProgramLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Program</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel Program Confirmation */}
      <ConfirmDialog
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        onConfirm={handleCancelProgramConfirm}
        title="Cancel Program"
        description={`Are you sure you want to cancel "${program.name}"? Status will be updated to "cancelled".`}
        isLoading={cancelLoading}
        confirmLabel="Cancel Program"
      />

      {/* Add Course Modal */}
      <Modal
        isOpen={isAddCourseOpen}
        onClose={() => setIsAddCourseOpen(false)}
        title="Add Course / Track to Program"
      >
        <form onSubmit={handleAddCourseSubmit} className="space-y-4 text-xs">
          {courseError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-md flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{courseError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Course / Track Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={courseNameInput}
              onChange={(e) => setCourseNameInput(e.target.value)}
              placeholder="e.g. Data Science Track"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddCourseOpen(false)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addCourseLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {addCourseLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Add Course</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Enroll Participant Modal */}
      <Modal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        title={`Enroll Participant — ${program.name}`}
      >
        <form onSubmit={handleEnrollSubmit} className="space-y-4 text-xs">
          {enrollError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-md flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{enrollError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={enrollForm.full_name}
              onChange={(e) => setEnrollForm({ ...enrollForm, full_name: e.target.value })}
              placeholder="Full Name"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={enrollForm.email}
                onChange={(e) => setEnrollForm({ ...enrollForm, email: e.target.value })}
                placeholder="participant@example.com"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={enrollForm.phone}
                onChange={(e) => setEnrollForm({ ...enrollForm, phone: e.target.value })}
                placeholder="+234..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
            <select
              value={enrollForm.gender}
              onChange={(e) => setEnrollForm({ ...enrollForm, gender: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="">Select Gender...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {courses.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Select Course / Track <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <select
                value={enrollForm.course_id}
                onChange={(e) => setEnrollForm({ ...enrollForm, course_id: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                <option value="">Unassigned (No course/track selected)</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEnrollModalOpen(false)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={enrollLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {enrollLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Enroll Participant</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Course Modal */}
      <Modal
        isOpen={Boolean(changeCourseTarget)}
        onClose={() => setChangeCourseTarget(null)}
        title={`Change Course Assignment — ${changeCourseTarget?.participant.full_name}`}
      >
        <form onSubmit={handleChangeCourseSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Select Course / Track
            </label>
            <select
              value={changeCourseSelectedId}
              onChange={(e) => setChangeCourseSelectedId(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="">Unassigned (No course/track selected)</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setChangeCourseTarget(null)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={changeCourseLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {changeCourseLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Assignment</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Update Enrollment Status Modal */}
      <Modal
        isOpen={Boolean(updateEnrollmentTarget)}
        onClose={() => setUpdateEnrollmentTarget(null)}
        title="Update Enrollment Status"
      >
        <form onSubmit={handleUpdateStatusConfirm} className="space-y-4 text-xs">
          <p className="text-xs text-slate-600">
            Updating enrollment status for{" "}
            <span className="font-bold text-slate-900">
              {updateEnrollmentTarget?.participant.full_name}
            </span>{" "}
            in program <span className="font-semibold text-teal-700">{program.name}</span>.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Select New Enrollment Status
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="registered">Registered</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setUpdateEnrollmentTarget(null)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateStatusLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {updateStatusLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Status</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Drop Enrollment Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(dropTarget)}
        onClose={() => setDropTarget(null)}
        onConfirm={handleDropEnrollmentConfirm}
        title="Drop Enrollment"
        description={`Are you sure you want to drop "${dropTarget?.participant.full_name}" from this program? Status will be updated to "dropped".`}
        isLoading={dropLoading}
        confirmLabel="Drop Enrollment"
      />

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        programId={id}
        programName={program.name}
        onSuccess={() => fetchProgramData(true)}
      />
    </div>
  );
}
