import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError, clearImpersonation, invalidateAuthSession, readImpersonation, saveImpersonation, setAccessToken } from "../../services/api-client.js";
import type { OrganizationModules } from "../platform/module-registry.js";

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "org_admin" | "sub_admin" | "accounts_manager" | "field_recovery" | "employee" | "guard";
  modulePermissions?: Record<string, boolean>;
  modulePermissionsConfigured?: boolean;
  actionPermissions?: string[];
  /** True when action grants are enforced (always for subadmins; for team members once configured). */
  actionPermissionsConfigured?: boolean;
  permissionMode?: "role" | "actions";
  deniedScreens?: string[];
  customRoleId?: string | null;
  customRoleName?: string | null;
  workforceScope?: { mode: "organization" | "selected"; departmentIds: string[]; locationIds: string[] };
  organizationId: string | null;
  mustChangePassword: boolean;
  organization?: {
    id: string;
    publicCode?: string;
    name: string;
    legalName?: string;
    address?: string;
    status: string;
    timezone: string;
    showGuides?: boolean;
    currency: string;
    modules?: OrganizationModules;
    navOrder?: string[];
  } | null;
  /** Present when a platform admin opened this organization with the master password. */
  impersonatedBy?: { id: string; name: string; email: string } | null;
};

type AuthContextType = {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Platform admin opens an organization as its administrator (full page reload into the organization). */
  startImpersonation: (organizationId: string, organizationName: string, masterPassword: string) => Promise<void>;
  /** Leaves the organization and returns to the platform admin's own session. */
  exitImpersonation: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_SYNC_KEY = "payment-recovery-auth-session-change";
const TAB_ID = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  ? crypto.randomUUID()
  : String(Math.random());

function notifyOtherTabs() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTH_SYNC_KEY, JSON.stringify({ senderId: TAB_ID, timestamp: Date.now() }));
  } catch {
    /* BroadcastChannel remains available where storage is blocked. */
  }
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("payment-recovery-auth-session");
    channel.postMessage({ senderId: TAB_ID, type: "session-changed" });
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
      // Restore a platform admin's organization session in this tab first; fall back to the normal session.
      const impersonation = readImpersonation();
      if (impersonation) {
        try {
          setAccessToken(impersonation.accessToken);
          const profile = await api.getMe();
          if (mounted && generation === authGenerationRef.current) updateUser(profile);
          if (mounted) setIsLoading(false);
          return;
        } catch {
          clearImpersonation();
          invalidateAuthSession();
        }
      }
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
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_SYNC_KEY && event.newValue) {
        try {
          const payload = JSON.parse(event.newValue);
          if (payload?.senderId === TAB_ID) return;
        } catch {
          // If value is not JSON, proceed with clearing
        }
        clearThisTab();
      }
    };
    const returnToPlatform = () => { window.location.assign("/platform"); };
    window.addEventListener("impersonation-ended", returnToPlatform);
    window.addEventListener("auth-session-expired", clearThisTab);
    window.addEventListener("storage", onStorage);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("payment-recovery-auth-session") : null;
    if (channel) {
      channel.onmessage = (event) => {
        if (event.data?.senderId === TAB_ID) return;
        clearThisTab();
      };
    }
    return () => {
      window.removeEventListener("impersonation-ended", returnToPlatform);
      window.removeEventListener("auth-session-expired", clearThisTab);
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const generation = ++authGenerationRef.current;
    updateUser(null);
    queryClient.clear();
    clearImpersonation();
    // Revoke any refresh cookie left by a previous account on this browser first.
    await api.logout();
    const session = await api.login(credentials);
    if (generation !== authGenerationRef.current) throw new Error("Sign-in was superseded by another session change. Please try again.");
    updateUser(session.user);
    queryClient.clear();
    notifyOtherTabs();
    return session.user;
  };

  const startImpersonation = async (organizationId: string, organizationName: string, masterPassword: string) => {
    const session = await api.impersonateOrganization(organizationId, masterPassword);
    saveImpersonation({ accessToken: session.accessToken, expiresAt: session.expiresAt, organizationName });
    // Full reload so no platform data stays cached in memory while inside the organization.
    window.location.assign("/");
  };

  const exitImpersonation = () => {
    clearImpersonation();
    invalidateAuthSession();
    window.location.assign("/platform");
  };

  const logout = async () => {
    // Signing out while inside an organization only leaves it; the platform admin stays signed in.
    if (userRef.current?.impersonatedBy) {
      exitImpersonation();
      return;
    }
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
        startImpersonation,
        exitImpersonation,
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
