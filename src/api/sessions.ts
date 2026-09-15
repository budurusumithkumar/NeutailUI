import { apiClient } from "./client";
import type { SessionContext, SessionResponse } from "./types";

export async function createSession(
  channel: "web" | "mobile" | "demo" = "web",
): Promise<SessionResponse> {
  const { data } = await apiClient.post<SessionResponse>("/api/v1/sessions", { channel });
  return data;
}

export async function getSession(sessionId: string): Promise<SessionResponse> {
  const { data } = await apiClient.get<SessionResponse>(`/api/v1/sessions/${sessionId}`);
  return data;
}

export async function getSessionContext(sessionId: string): Promise<SessionContext> {
  const { data } = await apiClient.get<SessionContext>(
    `/api/v1/sessions/${sessionId}/context`,
  );
  return data;
}

export async function closeSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/api/v1/sessions/${sessionId}`);
}
