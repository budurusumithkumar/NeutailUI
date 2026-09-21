import { apiClient } from "./client";
import type {
  FitIntervention,
  FitInterventionEventInput,
  FitInterventionEventResponse,
  FitInterventionEventType,
} from "./types";

export async function getPendingFitInterventions(): Promise<FitIntervention[]> {
  const { data } = await apiClient.get<FitIntervention[]>(
    "/api/v1/fit/interventions",
    { params: { status: "ACTION_REQUIRED" } },
  );
  return data;
}

export async function recordFitInterventionEvent(
  interventionId: string,
  eventType: FitInterventionEventType,
  options: { selectedSize?: string; idempotencyKey: string },
): Promise<FitInterventionEventResponse> {
  const payload: FitInterventionEventInput = {
    event_type: eventType,
    idempotency_key: options.idempotencyKey,
    ...(options.selectedSize ? { selected_size: options.selectedSize } : {}),
  };
  const { data } = await apiClient.post<FitInterventionEventResponse>(
    `/api/v1/fit/interventions/${encodeURIComponent(interventionId)}/events`,
    payload,
  );
  return data;
}
