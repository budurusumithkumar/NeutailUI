import type { AgentActivity, AgentStatus } from "../../../api/types";

const statusIcon: Record<AgentStatus, string> = {
  STARTED: "⋯",
  COMPLETED: "✓",
  FAILED: "⚠",
  SKIPPED: "–",
};

const statusClass: Record<AgentStatus, string> = {
  STARTED: "text-neutral-400",
  COMPLETED: "text-emerald-600",
  FAILED: "text-rose-600",
  SKIPPED: "text-neutral-400",
};

export function AgentActivityStrip({ activity }: { activity: AgentActivity[] }) {
  if (activity.length === 0) return null;

  const hasFailure = activity.some((entry) => entry.status === "FAILED");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
      {activity.map((entry) => (
        <span key={entry.agent} className={statusClass[entry.status]}>
          {statusIcon[entry.status]} {entry.agent}
        </span>
      ))}
      {hasFailure && <span className="text-rose-600">Partial response</span>}
    </div>
  );
}
