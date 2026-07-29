"use client";

import React, { useState } from "react";
import { KeyRound, User, Mail, Shield, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setError("Please enter your current password");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to change password");
      }

      setSuccessMsg("Your password has been changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
        <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
        <span>Loading account settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <KeyRound className="w-5 h-5 text-teal-700" />
          <span>My Account Settings</span>
        </h1>
        <p className="text-xs text-slate-500">
          View your staff profile details and change your account password
        </p>
      </div>

      {/* Account Overview Card */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4 text-xs">
        <h2 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
          Staff Profile Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div>
              <span className="text-slate-400 font-medium block text-[11px]">Full Name</span>
              <span className="font-semibold text-slate-900">{user?.full_name}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <span className="text-slate-400 font-medium block text-[11px]">Email Address</span>
              <span className="font-semibold text-slate-900 font-mono text-[11px]">{user?.email}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <Shield className="w-4 h-4 text-teal-700" />
            </div>
            <div>
              <span className="text-slate-400 font-medium block text-[11px]">Role</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-teal-100 text-teal-800">
                {user?.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Self-Service Change Password Card */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-2">
          <h2 className="font-bold text-slate-900 text-sm">Self-Service Password Change</h2>
          <p className="text-slate-500 text-[11px]">
            To update your password, enter your current password followed by your new password.
          </p>
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

        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Current Password <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              New Password (min 6 characters) <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Confirm New Password <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs rounded-md shadow-xs transition disabled:opacity-50 flex items-center space-x-1.5"
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Update Password</span>
          </button>
        </form>
      </div>
    </div>
  );
}
