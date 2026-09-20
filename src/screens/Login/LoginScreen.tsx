import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../api/auth";
import { resetDemoData } from "../../api/demo";
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

function describeResetError(error: unknown): string | null {
  if (!error) return null;
  if (isAxiosError<{ detail?: string }>(error) && error.response) {
    return error.response.data?.detail ?? "Demo data could not be reset.";
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
  const [resetMessage, setResetMessage] = useState<string | null>(null);

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

  const resetMutation = useMutation({
    mutationFn: () => resetDemoData(password || "demo"),
    onMutate: () => setResetMessage(null),
    onSuccess: (data) => {
      queryClient.clear();
      setResetMessage(data.message);
    },
  });

  const errorMessage = describeLoginError(loginMutation.error);

  function selectDemoCustomer(customer: "alice" | "bob" | "grace") {
    const demoEmails = {
      alice: "alice.demo@demo.neutail.local",
      bob: "bob.demo@demo.neutail.local",
      grace: "grace.morris5@demo.neutail.local",
    };
    setEmail(demoEmails[customer]);
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
            Use Alice or Bob for segmentation. Use Grace for the post-delivery Fit exchange flow.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Button type="button" variant="secondary" onClick={() => selectDemoCustomer("alice")}>
              Alice · Affluent
            </Button>
            <Button type="button" variant="secondary" onClick={() => selectDemoCustomer("bob")}>
              Bob · Non-affluent
            </Button>
            <Button type="button" variant="secondary" onClick={() => selectDemoCustomer("grace")}>
              Grace · Size &amp; Fit
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

        <div className="border-t border-neutral-100 pt-2 text-center">
          <button
            type="button"
            className="text-xs text-neutral-400 underline-offset-2 transition hover:text-neutral-600 hover:underline disabled:cursor-wait disabled:opacity-60"
            disabled={resetMutation.isPending}
            onClick={() => resetMutation.mutate()}
          >
            {resetMutation.isPending ? "Resetting demo…" : "Reset demo data"}
          </button>
          {(resetMessage || resetMutation.error) && (
            <p
              className={`mt-1 text-xs ${resetMutation.error ? "text-rose-500" : "text-neutral-400"}`}
              role="status"
            >
              {resetMessage ?? describeResetError(resetMutation.error)}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
