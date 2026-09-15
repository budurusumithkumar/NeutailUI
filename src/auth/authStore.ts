import { create } from "zustand";
import type { AuthUser } from "../api/types";

const TOKEN_STORAGE_KEY = "neutail_token";

export type AuthStatus = "idle" | "authenticating" | "authenticated" | "expired";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  status: AuthStatus;
  sessionExpired: boolean;
  setSession: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  clear: () => void;
  handleUnauthorized: () => void;
  acknowledgeSessionExpired: () => void;
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // storage unavailable (e.g. private mode) — fall back to in-memory-only auth
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: readStoredToken(),
  user: null,
  status: readStoredToken() ? "idle" : "idle",
  sessionExpired: false,

  setSession: (token, user) => {
    writeStoredToken(token);
    set({ token, user, status: "authenticated", sessionExpired: false });
  },

  setUser: (user) => set({ user, status: "authenticated" }),

  clear: () => {
    writeStoredToken(null);
    set({ token: null, user: null, status: "idle" });
  },

  handleUnauthorized: () => {
    writeStoredToken(null);
    set({ token: null, user: null, status: "expired", sessionExpired: true });
  },

  acknowledgeSessionExpired: () => set({ sessionExpired: false }),
}));
