import { apiClient } from "./client";
import type { HomeRecommendationsResponse } from "./types";

export async function getHomeRecommendations(
  limit = 8,
): Promise<HomeRecommendationsResponse> {
  const { data } = await apiClient.get<HomeRecommendationsResponse>(
    "/api/v1/recommendations/home",
    { params: { limit } },
  );
  return data;
}
