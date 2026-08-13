import { getDailySeries, getLastGoodSeries } from "@/lib/nifty-data";
import type { DailyRecord } from "@/lib/nifty-data";

export async function GET(): Promise<Response> {
  try {
    const records = await getDailySeries();
    return Response.json({ records });
  } catch (cause) {
    const cached = getLastGoodSeries();
    if (cached) {
      return Response.json({ records: cached });
    }
    const message = cause instanceof Error ? cause.message : "Failed to load market data";
    return Response.json({ error: message }, { status: 502 });
  }
}

export type SeriesResponse = { records: DailyRecord[] } | { error: string };
