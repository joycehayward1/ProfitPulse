"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getInsForgeClient } from "@/lib/insforge";

interface User {
  id: string;
  email: string;
  name?: string;
  profile?: {
    name?: string;
    avatar_url?: string;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function loadUser() {
    try {
      const client = getInsForgeClient();
      const { data, error } = await client.auth.getCurrentSession();

      if (error || !data?.session) {
        setUser(null);
        setLoading(false);
        return;
      }

      const sessionUser = data.session.user;
      setUser({
        id: sessionUser.id,
        email: sessionUser.email || "",
        name: sessionUser.profile?.name,
        profile: sessionUser.profile,
      });
    } catch (error) {
      console.error("Error loading user:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    try {
      const client = getInsForgeClient();
      await client.auth.signOut();
      setUser(null);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }

  async function refreshUser() {
    await loadUser();
  }

  useEffect(() => {
    loadUser();

    // Note: InsForge SDK may not support onAuthStateChange listener
    // User state will be loaded on mount and updated on sign in/out actions
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
