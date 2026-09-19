import { apiClient } from "./client";
import type { DemoCheckoutRequest, PurchaseEventResult } from "./types";

export async function completeDemoCheckout(
  payload: DemoCheckoutRequest,
): Promise<PurchaseEventResult> {
  const { data } = await apiClient.post<PurchaseEventResult>(
    "/api/v1/demo/checkout",
    payload,
  );
  return data;
}
