import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { logout as logoutRequest } from "../../api/auth";
import { getCustomerSummary } from "../../api/customer";
import { useAuthStore } from "../../auth/authStore";
import { AppLayout } from "../../components/AppLayout";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";

export function ProfileScreen() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clear);

  const summaryQuery = useQuery({
    queryKey: ["customer", "summary"],
    queryFn: getCustomerSummary,
  });

  async function handleLogout() {
    try {
      await logoutRequest();
    } catch {
      // best-effort — proceed to clear local state regardless (docs/02-user-flows.md, Flow G)
    }
    clearAuth();
    navigate("/login", { replace: true });
  }

  const summary = summaryQuery.data;

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold">Profile</h1>

      {summary && (
        <div className="mt-4 space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <div>
            <p className="text-lg font-medium">{summary.display_name}</p>
            {summary.city && <p className="text-sm text-neutral-500">{summary.city}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            {summary.loyalty_tier && <Chip tone="success">{summary.loyalty_tier} tier</Chip>}
            {typeof summary.points_balance === "number" && (
              <Chip>{summary.points_balance} points</Chip>
            )}
            {summary.usual_size && <Chip>Usual size: {summary.usual_size}</Chip>}
            {summary.fit_preference && <Chip>Fit: {summary.fit_preference}</Chip>}
          </div>

          {summary.preferred_categories.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase text-neutral-400">
                Preferred categories
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {summary.preferred_categories.map((category) => (
                  <Chip key={category}>{category}</Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Button variant="secondary" className="mt-6" onClick={handleLogout}>
        Log out
      </Button>
    </AppLayout>
  );
}
