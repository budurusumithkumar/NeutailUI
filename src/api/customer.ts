import { apiClient } from "./client";
import type { CustomerSummary } from "./types";

export async function getCustomerSummary(): Promise<CustomerSummary> {
  const { data } = await apiClient.get<CustomerSummary>("/api/v1/customers/me/summary");
  return data;
}
