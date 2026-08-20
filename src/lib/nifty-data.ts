import YahooFinance from "yahoo-finance2";
import axios from "axios";
import { readFiiDiiMap, syncFiiDii, type FiiDiiRow } from "./fii-dii";

export type DailyRecord = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  fii: number | null;
  dii: number | null;
  net: number | null;
};

const CHARTIST_URL = "https://fii-diidata.mrchartist.com/api/history-full";

const CACHE_TTL_MS = 60 * 60 * 1000;
const YAHOO_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
const MAX_ATTEMPTS = 4;
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

const yahooFinance = new YahooFinance();

let lastGoodSeries: DailyRecord[] | null = null;
let seriesCache: { records: DailyRecord[]; expiresAt: number } | null = null;

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function parseChartistDate(value: string): string | null {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value);
  if (!match) return null;
  const month = MONTHS[match[2]];
  if (month === undefined) return null;
  const day = match[1].padStart(2, "0");
  const mon = String(month + 1).padStart(2, "0");
  return `${match[3]}-${mon}-${day}`;
}

function istParts(timestampMs: number): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(timestampMs);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function isUnfinalizedToday(barDate: string): boolean {
  const now = istParts(Date.now());
  return barDate === now.date && now.minutes < 16 * 60;
}

type YahooBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function describeYahooError(cause: unknown): Error {
  if (
    cause &&
    typeof cause === "object" &&
    typeof (cause as { code?: unknown }).code === "number"
  ) {
    return new Error(`Yahoo Finance responded with ${(cause as { code: number }).code}`);
  }
  if (cause instanceof Error) return cause;
  return new Error("Failed to fetch NIFTY data");
}

async function fetchYahooDaily(): Promise<YahooBar[]> {
  const period1 = new Date(Date.now() - TWO_YEARS_MS);
  const period2 = new Date();
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    yahooFinance._setOpts({ YF_QUERY_HOST: YAHOO_HOSTS[attempt % YAHOO_HOSTS.length] });
    try {
      const result = await yahooFinance.chart("^NSEI", {
        period1,
        period2,
        interval: "1d",
        events: "history",
        return: "array",
      });
      const bars: YahooBar[] = [];
      for (const quote of result.quotes) {
        const { open, high, low, close, volume } = quote;
        if (open == null || high == null || low == null || close == null || volume == null) {
          continue;
        }
        const { date } = istParts(quote.date.getTime());
        if (isUnfinalizedToday(date)) {
          continue;
        }
        bars.push({ date, open, high, low, close, volume });
      }
      return bars;
    } catch (cause) {
      lastError = cause;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw describeYahooError(lastError);
}

async function fetchInstitutional(): Promise<Map<string, { fii: number; dii: number }>> {
  const map = new Map<string, { fii: number; dii: number }>();
  try {
    const response = await axios.get(CHARTIST_URL, {
      timeout: 10_000,
      headers: { Accept: "application/json" },
    });
    const rows = response.data as Array<{ d: string; fn?: number; dn?: number }>;
    if (!Array.isArray(rows)) return map;
    for (const row of rows) {
      const iso = parseChartistDate(row.d ?? "");
      if (!iso || row.fn == null || row.dn == null) continue;
      map.set(iso, { fii: row.fn, dii: row.dn });
    }
  } catch {
    // Institutional data is best-effort; the chart degrades to candles + volume only.
  }
  return map;
}

export async function getDailySeries(): Promise<DailyRecord[]> {
  if (seriesCache && Date.now() < seriesCache.expiresAt) {
    return seriesCache.records;
  }
  const yahoo = await fetchYahooDaily();
  const dbMap = await readFiiDiiMap();
  const institutional =
    dbMap === null || dbMap.size === 0 ? await fetchInstitutional() : dbMap;

  const needsBackfill = dbMap !== null && dbMap.size === 0;
  if (dbMap !== null && dbMap.size > 0) {
    const lastDbDate = [...dbMap.keys()].sort()[dbMap.size - 1] ?? null;
    const newestYahooDate = yahoo.length > 0 ? yahoo[yahoo.length - 1].date : null;
    if (lastDbDate !== null && newestYahooDate !== null && lastDbDate < newestYahooDate) {
      const chartist = await fetchInstitutional();
      const fresh: Map<string, { fii: number; dii: number }> = new Map();
      for (const [date, value] of chartist) {
        if (date > lastDbDate) {
          fresh.set(date, value);
          institutional.set(date, value);
        }
      }
      if (fresh.size > 0) {
        const rows: FiiDiiRow[] = [...fresh].map(([date, value]) => ({
          date,
          fii: value.fii,
          dii: value.dii,
        }));
        await syncFiiDii(rows);
      }
    }
  }

  const records = yahoo
    .map((bar) => {
      const inst = institutional.get(bar.date);
      const fii = inst?.fii ?? null;
      const dii = inst?.dii ?? null;
      const net = fii !== null && dii !== null ? fii + dii : null;
      return { ...bar, fii, dii, net };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (needsBackfill) {
    const rows = records
      .filter(
        (record): record is DailyRecord & { fii: number; dii: number } =>
          record.fii !== null && record.dii !== null
      )
      .map((record) => ({ date: record.date, fii: record.fii, dii: record.dii }));
    if (rows.length > 0) {
      void syncFiiDii(rows);
    }
  }

  lastGoodSeries = records;
  seriesCache = { records, expiresAt: Date.now() + CACHE_TTL_MS };
  return records;
}

export function getLastGoodSeries(): DailyRecord[] | null {
  return lastGoodSeries;
}
