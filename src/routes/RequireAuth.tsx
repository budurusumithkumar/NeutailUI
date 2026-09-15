import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../auth/authStore";

export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
