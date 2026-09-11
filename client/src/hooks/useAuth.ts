import { useState, useEffect, useCallback } from "react";

export interface AuthUser {
  id: number;
  email: string;
  emailVerified: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem("magnet_token");
    if (!token) {
      setState({ user: null, loading: false });
      return;
    }

    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setState({ user: data.user, loading: false });
      } else {
        localStorage.removeItem("magnet_token");
        setState({ user: null, loading: false });
      }
    } catch {
      setState({ user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Login failed" };
      }
      localStorage.setItem("magnet_token", data.token);
      setState({ user: data.user, loading: false });
      return { success: true };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const register = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Registration failed" };
      }
      localStorage.setItem("magnet_token", data.token);
      setState({ user: data.user, loading: false });
      return { success: true };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const loginWithGoogle = async (credential: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Google sign-in failed" };
      }
      localStorage.setItem("magnet_token", data.token);
      setState({ user: data.user, loading: false });
      return { success: true };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const logout = () => {
    localStorage.removeItem("magnet_token");
    setState({ user: null, loading: false });
  };

  const token = localStorage.getItem("magnet_token") || undefined;

  return {
    user: state.user,
    loading: state.loading,
    token,
    login,
    loginWithGoogle,
    register,
    logout,
  };
}
