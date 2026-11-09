import React, { createContext, useContext, useEffect, useState } from "react";
import { api, setAccessToken } from "../../services/api-client.js";
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = async () => {
    try {
      const profile = await api.getMe();
      setUser(profile);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function initAuth() {
      try {
        const session = await api.refresh();
        if (mounted) {
          setUser(session.user);
        }
      } catch {
        if (mounted) {
          setAccessToken(null);
          setUser(null);
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
    const refreshOnFocus = () => { void refreshProfile(); };
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const session = await api.login(credentials);
    setUser(session.user);
    return session.user;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
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
