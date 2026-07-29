"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useContext, useEffect, useState } from "react";

export type CurrentUser = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "facilitator";
};

type AuthContextType = {
  user: CurrentUser | null;
  assignedProgramIds: string[];
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  assignedProgramIds: [],
  loading: true,
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [assignedProgramIds, setAssignedProgramIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        setUser(json.data);
        setAssignedProgramIds(json.data.assignedProgramIds || []);
      } else {
        setUser(null);
        setAssignedProgramIds([]);
      }
    } catch {
      setUser(null);
      setAssignedProgramIds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network error on logout
    } finally {
      setUser(null);
      setAssignedProgramIds([]);
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        assignedProgramIds,
        loading,
        logout,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
