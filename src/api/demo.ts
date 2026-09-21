import { apiClient } from "./client";
import type { DemoResetResponse } from "./types";

export async function resetDemoData(password: string): Promise<DemoResetResponse> {
  const { data } = await apiClient.post<DemoResetResponse>("/api/v1/demo/reset", {
    password,
  });
  return data;
}
