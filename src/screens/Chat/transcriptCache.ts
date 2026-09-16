import { normalizeChatResponse } from "../../api/chatResponseAdapter";
import type { TranscriptEntry } from "./types";

// The backend contract has no endpoint to retrieve prior messages (docs/03-api-integration.md,
// Gap #2) — this is a client-side cache for UX continuity within the same tab/session,
// not a source of truth.
function cacheKey(sessionId: string): string {
  return `neutail_transcript_${sessionId}`;
}

export function loadTranscript(sessionId: string): TranscriptEntry[] {
  try {
    const raw = sessionStorage.getItem(cacheKey(sessionId));
    if (!raw) return [];

    const entries = JSON.parse(raw) as TranscriptEntry[];
    return entries.map((entry) =>
      entry.kind === "assistant"
        ? { ...entry, response: normalizeChatResponse(entry.response) }
        : entry,
    );
  } catch {
    return [];
  }
}

export function saveTranscript(sessionId: string, entries: TranscriptEntry[]): void {
  try {
    sessionStorage.setItem(cacheKey(sessionId), JSON.stringify(entries));
  } catch {
    // ignore — transcript just won't survive a reload this tab
  }
}
