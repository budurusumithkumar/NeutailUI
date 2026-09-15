// The active chat session id is tab-scoped (a session is one visit's conversation,
// not a durable account artifact — docs/03-api-integration.md), so it lives in
// sessionStorage rather than in a global store.

const SESSION_ID_KEY = "neutail_session_id";

export function getStoredSessionId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_ID_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionId(sessionId: string): void {
  try {
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  } catch {
    // ignore — worst case we create a new session next time
  }
}

export function clearStoredSessionId(): void {
  try {
    sessionStorage.removeItem(SESSION_ID_KEY);
  } catch {
    // ignore
  }
}
