import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getCurrentUser } from "../api/auth";
import { useAuthStore } from "./authStore";

// On app load, a token may exist in storage from a previous visit (docs/02-user-flows.md,
// Flow F). Validate it once before rendering routes, so RequireAuth doesn't bounce a
// still-valid session to /login just because `user` hasn't been fetched yet.
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const shouldValidate = Boolean(token) && !user;

  const { isFetching } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      return currentUser;
    },
    enabled: shouldValidate,
    retry: false,
  });

  if (shouldValidate && isFetching) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  return children;
}
