import { createSession } from "./sessions";
import { getStoredSessionId, setStoredSessionId } from "./sessionState";

const pendingSessions = new Map<string, Promise<string>>();

// Shared by Home (opening chat for the first time) and Chat (direct navigation /
// reload) so a session is only ever created once per browser tab.
export async function ensureSession(customerId: string): Promise<string> {
  const existing = getStoredSessionId(customerId);
  if (existing) {
    return existing;
  }

  const pending = pendingSessions.get(customerId);
  if (pending) {
    return pending;
  }

  const creation = createSession("web")
    .then((session) => {
      setStoredSessionId(customerId, session.session_id);
      return session.session_id;
    })
    .finally(() => {
      pendingSessions.delete(customerId);
    });

  pendingSessions.set(customerId, creation);
  return creation;
}
