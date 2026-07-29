"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { refreshUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Invalid email or password");
      }

      await refreshUser();
      router.push("/programs");
      router.refresh();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-lg bg-teal-700 text-white font-bold text-xl flex items-center justify-center mx-auto shadow-sm">
            PT
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            ProgramTrack Staff Login
          </h1>
          <p className="text-xs text-slate-500">
            Internal operations and program management system
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="staff@developmenthub.org"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs rounded-md shadow-xs transition disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Sign In to Dashboard</span>
            </button>
          </form>
        </div>

        <div className="text-center text-[11px] text-slate-500">
          Demo Admin: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">admin@developmenthub.org</code> / <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">admin123</code>
        </div>
      </div>
    </div>
  );
}
