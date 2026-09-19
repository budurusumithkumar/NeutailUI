import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../api/auth";
import { clearStoredSession } from "../../api/sessionState";
import type { ErrorResponse } from "../../api/types";
import { useAuthStore } from "../../auth/authStore";
import { Button } from "../../components/Button";

function describeLoginError(error: unknown): string | null {
  if (!error) return null;
  if (isAxiosError<ErrorResponse>(error) && error.response) {
    return error.response.data?.message ?? "Invalid email or password.";
  }
  return "Couldn't reach Neu.Tail. Please try again.";
}

export function LoginScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);
  const sessionExpired = useAuthStore((state) => state.sessionExpired);
  const acknowledgeSessionExpired = useAuthStore((state) => state.acknowledgeSessionExpired);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      clearStoredSession(data.user.customer_id);
      queryClient.removeQueries();
      acknowledgeSessionExpired();
      setSession(data.access_token, data.user);
      navigate("/", { replace: true });
    },
  });

  const errorMessage = describeLoginError(loginMutation.error);

  function selectDemoCustomer(customer: "alice" | "bob") {
    setEmail(`${customer}.demo@demo.neutail.local`);
    setPassword("demo");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <form
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          loginMutation.mutate({ email, password });
        }}
      >
        <div>
          <h1 className="text-xl font-semibold">Sign in to Neu.Tail</h1>
          <p className="mt-1 text-sm text-neutral-500">Your personal style assistant.</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Segmentation demo
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Both customers begin with two qualifying purchases. Checkout once to see their segment change.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" onClick={() => selectDemoCustomer("alice")}>
              Alice · Affluent
            </Button>
            <Button type="button" variant="secondary" onClick={() => selectDemoCustomer("bob")}>
              Bob · Non-affluent
            </Button>
          </div>
        </div>

        {sessionExpired && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Your session expired. Please sign in again.
          </p>
        )}

        <label className="block text-sm font-medium text-neutral-700">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
        </label>

        <label className="block text-sm font-medium text-neutral-700">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
        </label>

        {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}

        <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
