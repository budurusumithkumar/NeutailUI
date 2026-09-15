import { createSession } from "./sessions";
import { getStoredSessionId, setStoredSessionId } from "./sessionState";

// Shared by Home (opening chat for the first time) and Chat (direct navigation /
// reload) so a session is only ever created once per browser tab.
export async function ensureSession(): Promise<string> {
  const existing = getStoredSessionId();
  if (existing) {
    return existing;
  }
  const session = await createSession("web");
  setStoredSessionId(session.session_id);
  return session.session_id;
}
