"use client";

import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import type { SeriesResponse } from "@/app/api/series/route";
import type { DailyRecord } from "@/lib/nifty-data";

export const STALE_TIME_MS = 5 * 60 * 1000;

async function fetchSeries(): Promise<DailyRecord[]> {
  try {
    const response = await axios.get<SeriesResponse>("/api/series");
    const body = response.data;
    if ("error" in body) {
      throw new Error(body.error);
    }
    return body.records;
  } catch (cause) {
    if (axios.isAxiosError(cause)) {
      const data = cause.response?.data as SeriesResponse | undefined;
      if (data && "error" in data) {
        throw new Error(data.error);
      }
      throw new Error(`Request failed with status ${cause.response?.status ?? "unknown"}`);
    }
    throw cause;
  }
}

export function useNiftySeries() {
  return useQuery({
    queryKey: ["nifty-series"],
    queryFn: fetchSeries,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
}
