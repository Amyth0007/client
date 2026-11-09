import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError, invalidateAuthSession } from "../../services/api-client.js";
import type { OrganizationModules } from "../platform/module-registry.js";

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "org_admin" | "accounts_manager" | "field_recovery" | "employee";
  modulePermissions?: Record<string, boolean>;
  modulePermissionsConfigured?: boolean;
  organizationId: string | null;
  mustChangePassword: boolean;
  organization?: {
    id: string;
    name: string;
    status: string;
    timezone: string;
    currency: string;
    modules?: OrganizationModules;
  } | null;
};

type AuthContextType = {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_SYNC_KEY = "payment-recovery-auth-session-change";

function notifyOtherTabs() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(AUTH_SYNC_KEY, String(Date.now())); } catch { /* BroadcastChannel remains available where storage is blocked. */ }
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("payment-recovery-auth-session");
    channel.postMessage("session-changed");
    channel.close();
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const userRef = useRef<UserProfile | null>(null);
  const authGenerationRef = useRef(0);
  const updateUser = (nextUser: UserProfile | null) => {
    userRef.current = nextUser;
    setUser(nextUser);
  };

  const refreshProfile = async () => {
    if (!userRef.current) return;
    const generation = authGenerationRef.current;
    try {
      const profile = await api.getMe();
      if (generation === authGenerationRef.current && userRef.current?.id === profile.id) updateUser(profile);
    } catch (error) {
      if (generation === authGenerationRef.current && error instanceof ApiError && error.status === 401) {
        invalidateAuthSession();
        updateUser(null);
        queryClient.clear();
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    const generation = authGenerationRef.current;
    async function initAuth() {
      try {
        const session = await api.refresh();
        if (mounted && generation === authGenerationRef.current) {
          updateUser(session.user);
        }
      } catch {
        if (mounted && generation === authGenerationRef.current) {
          invalidateAuthSession();
          updateUser(null);
          queryClient.clear();
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }
    initAuth();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const refreshOnFocus = () => { if (userRef.current) void refreshProfile(); };
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, []);

  useEffect(() => {
    const clearThisTab = () => {
      authGenerationRef.current += 1;
      invalidateAuthSession();
      updateUser(null);
      queryClient.clear();
    };
    const onStorage = (event: StorageEvent) => { if (event.key === AUTH_SYNC_KEY) clearThisTab(); };
    window.addEventListener("auth-session-expired", clearThisTab);
    window.addEventListener("storage", onStorage);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("payment-recovery-auth-session") : null;
    if (channel) channel.onmessage = clearThisTab;
    return () => { window.removeEventListener("auth-session-expired", clearThisTab); window.removeEventListener("storage", onStorage); channel?.close(); };
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const generation = ++authGenerationRef.current;
    updateUser(null);
    queryClient.clear();
    notifyOtherTabs();
    // Revoke any refresh cookie left by a previous account on this browser first.
    await api.logout();
    const session = await api.login(credentials);
    if (generation !== authGenerationRef.current) throw new Error("Sign-in was superseded by another session change. Please try again.");
    updateUser(session.user);
    queryClient.clear();
    return session.user;
  };

  const logout = async () => {
    authGenerationRef.current += 1;
    updateUser(null);
    queryClient.clear();
    notifyOtherTabs();
    await api.logout();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
