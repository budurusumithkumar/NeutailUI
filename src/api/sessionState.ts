// Chat remains tab-scoped, but every authenticated customer gets a separate key.
// This prevents a second customer using the same browser tab from inheriting the
// previous customer's backend session or cached transcript.
const LEGACY_SESSION_ID_KEY = "neutail_session_id";
const SESSION_ID_KEY_PREFIX = "neutail_session_id_";
const TRANSCRIPT_KEY_PREFIX = "neutail_transcript_";

function sessionKey(customerId: string): string {
  return `${SESSION_ID_KEY_PREFIX}${encodeURIComponent(customerId)}`;
}

export function getTranscriptStorageKey(sessionId: string): string {
  return `${TRANSCRIPT_KEY_PREFIX}${sessionId}`;
}

export function getStoredSessionId(customerId: string): string | null {
  try {
    return sessionStorage.getItem(sessionKey(customerId));
  } catch {
    return null;
  }
}

export function setStoredSessionId(customerId: string, sessionId: string): void {
  try {
    sessionStorage.setItem(sessionKey(customerId), sessionId);
  } catch {
    // ignore — worst case we create a new session next time
  }
}

export function clearStoredSession(customerId: string): void {
  try {
    const customerSessionId = sessionStorage.getItem(sessionKey(customerId));
    if (customerSessionId) {
      sessionStorage.removeItem(getTranscriptStorageKey(customerSessionId));
    }
    sessionStorage.removeItem(sessionKey(customerId));

    // Remove state created by older UI versions without assigning it to any user.
    const legacySessionId = sessionStorage.getItem(LEGACY_SESSION_ID_KEY);
    if (legacySessionId) {
      sessionStorage.removeItem(getTranscriptStorageKey(legacySessionId));
    }
    sessionStorage.removeItem(LEGACY_SESSION_ID_KEY);
  } catch {
    // ignore
  }
}
