import { apiClient } from "./client";
import type { ChatRequest, ChatResponse } from "./types";

// UI must never send customer_id — identity is derived from the JWT server-side
// (see the "chat" operation description in the OpenAPI contract). ChatRequest has
// no such field, so there is nothing to accidentally forward here.
export async function postChat(payload: ChatRequest): Promise<ChatResponse> {
  const { data } = await apiClient.post<ChatResponse>("/api/v1/chat", payload);
  return data;
}
