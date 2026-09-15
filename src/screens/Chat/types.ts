import type { ChatRequest, ChatResponse } from "../../api/types";

export type TranscriptEntry =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; response: ChatResponse }
  | { id: string; kind: "assistant-error"; text: string; retryPayload: ChatRequest };
