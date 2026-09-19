import axios from "axios";
import { useAuthStore } from "../auth/authStore";
import { clearStoredSession } from "./sessionState";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export const apiClient = axios.create({ baseURL });

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// Global 401 handling (docs/03-api-integration.md): any authenticated call that
// comes back unauthorized clears auth state so RequireAuth redirects to /login.
// The login call itself is excluded — a 401 there is an expected "bad credentials"
// response the Login screen shows inline, not a session expiry.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginCall = error.config?.url?.includes("/api/v1/auth/login");
    if (error.response?.status === 401 && !isLoginCall) {
      const auth = useAuthStore.getState();
      if (auth.user?.customer_id) {
        clearStoredSession(auth.user.customer_id);
      }
      auth.handleUnauthorized();
    }
    return Promise.reject(error);
  },
);
