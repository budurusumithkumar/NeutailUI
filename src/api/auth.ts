import { apiClient } from "./client";
import type { AuthUser, LoginRequest, LoginResponse } from "./types";

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/api/v1/auth/login", payload);
  return data;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>("/api/v1/auth/me");
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/api/v1/auth/logout");
}
