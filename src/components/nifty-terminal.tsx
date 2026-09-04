"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
  ColorType,
  LineStyle,
} from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  MouseEventParams,
  Time,
  BusinessDay,
} from "lightweight-charts";
import type { DailyRecord } from "@/lib/nifty-data";
import { useNiftySeries } from "@/lib/use-nifty-series";
import {
  COLORS,
  formatCr,
  formatCrAxis,
  formatDate,
  formatPct,
  formatPrice,
  formatVolume,
} from "@/lib/nifty-format";

const PANE_LABELS = ["NIFTY 50", "DII", "FII", "FII+DII"];
const PANE_WEIGHTS = [0.56, 0.15, 0.15, 0.14];
const LEGEND = [
  { color: COLORS.up, label: "NIFTY up" },
  { color: COLORS.down, label: "NIFTY down" },
  { color: COLORS.fiiPos, label: "FII buy" },
  { color: COLORS.fiiNeg, label: "FII sell" },
  { color: COLORS.diiPos, label: "DII buy" },
  { color: COLORS.diiNeg, label: "DII sell" },
  { color: COLORS.netPos, label: "FII+DII positive" },
  { color: COLORS.netNeg, label: "FII+DII negative" },
];

function toDateKey(time: Time): string | null {
  if (typeof time === "string") return time;
  if (time && typeof time === "object") {
    const bd = time as BusinessDay;
    if (typeof bd.year === "number") {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${bd.year}-${pad(bd.month)}-${pad(bd.day)}`;
    }
  }
  return null;
}

function addInstitutionalPane(
  chart: IChartApi,
  paneIndex: number,
  records: DailyRecord[],
  key: "dii" | "fii" | "net",
  posColor: string,
  negColor: string
): ISeriesApi<"Histogram"> {
  const series = chart.addSeries(
    HistogramSeries,
    {
      priceFormat: { type: "custom", formatter: (v: number) => formatCrAxis(v) },
      priceLineVisible: false,
      lastValueVisible: false,
    },
    paneIndex
  );
  series.setData(
    records
      .filter((r) => r[key] !== null)
      .map((r) => ({
        time: r.date as Time,
        value: r[key] as number,
        color: (r[key] as number) >= 0 ? posColor : negColor,
      }))
  );
  series.createPriceLine({
    price: 0,
    color: COLORS.zeroLine,
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: false,
  });
  chart
    .priceScale("right", paneIndex)
    .applyOptions({ scaleMargins: { top: 0.22, bottom: 0.14 } });
  return series;
}

export default function NiftyTerminal() {
  const { data: records, isPending, isError, error } = useNiftySeries();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<DailyRecord | null>(null);
  const [paneTops, setPaneTops] = useState<number[]>([]);

  const firstInstitutional = useMemo(
    () => records?.find((r) => r.fii !== null)?.date,
    [records]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !records || records.length === 0) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: COLORS.bg },
        textColor: COLORS.text,
        fontSize: 11,
        fontFamily:
          "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace",
        panes: {
          enableResize: false,
          separatorColor: COLORS.separator,
          separatorHoverColor: COLORS.separatorHover,
        },
      },
      grid: {
        vertLines: { color: COLORS.grid },
        horzLines: { color: COLORS.grid },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.06, bottom: 0.18 },
      },
      timeScale: {
        borderVisible: false,
        rightOffset: 4,
        barSpacing: 8,
        minBarSpacing: 2,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: COLORS.crosshairLine,
          width: 1,
          style: LineStyle.Solid,
          labelBackgroundColor: COLORS.crosshairLabel,
        },
        horzLine: {
          color: COLORS.crosshairLine,
          width: 1,
          style: LineStyle.Solid,
          labelBackgroundColor: COLORS.crosshairLabel,
        },
      },
      localization: {
        locale: "en-IN",
        priceFormatter: (p: number) => formatPrice(p),
      },
    });

    const candles = chart.addSeries(
      CandlestickSeries,
      {
        upColor: COLORS.up,
        downColor: COLORS.down,
        wickUpColor: COLORS.up,
        wickDownColor: COLORS.down,
        borderVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      },
      0
    );

    const volume = chart.addSeries(
      HistogramSeries,
      {
        priceScaleId: "volume",
        priceFormat: { type: "custom", formatter: (v: number) => formatVolume(v) },
        priceLineVisible: false,
        lastValueVisible: false,
      },
      0
    );
    chart
      .priceScale("volume")
      .applyOptions({ scaleMargins: { top: 0.85, bottom: 0 }, visible: false });

    candles.setData(
      records.map((r) => ({
        time: r.date as Time,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
      }))
    );
    volume.setData(
      records.map((r) => ({
        time: r.date as Time,
        value: r.volume,
        color: r.close >= r.open ? COLORS.volumeUp : COLORS.volumeDown,
      }))
    );

    addInstitutionalPane(chart, 1, records, "dii", COLORS.diiPos, COLORS.diiNeg);
    addInstitutionalPane(chart, 2, records, "fii", COLORS.fiiPos, COLORS.fiiNeg);
    addInstitutionalPane(chart, 3, records, "net", COLORS.netPos, COLORS.netNeg);

    const applyPaneHeights = () => {
      const panes = chart.panes();
      const height = container.clientHeight;
      if (height <= 0) return;
      const explicit = PANE_WEIGHTS.slice(1).map((w) =>
        Math.max(30, Math.round(height * w))
      );
      const separatorTotal = panes.length - 1;
      const pane0Height = Math.max(
        30,
        height - explicit.reduce((a, b) => a + b, 0) - separatorTotal
      );
      panes.forEach((pane, i) => {
        pane.setHeight(i === 0 ? pane0Height : explicit[i - 1]);
      });
      const tops: number[] = [0];
      let acc = 0;
      panes.forEach((pane, i) => {
        acc += pane.getHeight();
        if (i < panes.length - 1) acc += 1;
        tops.push(acc);
      });
      setPaneTops(tops);
    };
    applyPaneHeights();

    const byDate = new Map(records.map((r) => [r.date, r]));
    const handleCrosshair = (param: MouseEventParams) => {
      if (param.time === undefined) {
        setSelected(null);
        return;
      }
      const dateKey = toDateKey(param.time);
      const record = dateKey ? byDate.get(dateKey) : undefined;
      setSelected(record ?? null);
    };
    chart.subscribeCrosshairMove(handleCrosshair);

    const resizeObserver = new ResizeObserver(() => applyPaneHeights());
    resizeObserver.observe(container);

    const len = records.length;
    chart
      .timeScale()
      .setVisibleLogicalRange({
        from: Math.max(-1, len - 181),
        to: len + 3,
      });

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [records]);

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Loading NIFTY data…
      </div>
    );
  }

  if (isError) {
    return (
      <main className="flex h-full items-center justify-center bg-[#0a0e13] px-6">
        <div className="max-w-md text-center">
          <p className="text-sm text-slate-400">Unable to load NIFTY data.</p>
          <p className="mt-2 text-xs text-slate-600">
            {error instanceof Error ? error.message : "Request failed"}
          </p>
        </div>
      </main>
    );
  }

  if (!records || records.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        No NIFTY data available right now.
      </div>
    );
  }

  const lastBar = records[records.length - 1];
  const prevBar = records[records.length - 2];
  const change = prevBar ? lastBar.close - prevBar.close : 0;
  const changePct = prevBar ? (change / prevBar.close) * 100 : 0;

  const active = selected ?? lastBar;
  const activeFiiColor =
    active.fii !== null ? (active.fii >= 0 ? COLORS.fiiPos : COLORS.fiiNeg) : COLORS.textDim;
  const activeDiiColor =
    active.dii !== null ? (active.dii >= 0 ? COLORS.diiPos : COLORS.diiNeg) : COLORS.textDim;
  const activeNetColor =
    active.net !== null ? (active.net >= 0 ? COLORS.netPos : COLORS.netNeg) : COLORS.textDim;

  return (
    <main className="flex h-full flex-col overflow-hidden bg-[#0a0e13] text-slate-200">
      <header className="px-5 pt-4 pb-2">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">NIFTY 50</h1>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Daily institutional-flow analytics · data through{" "}
              <span className="text-slate-400">{formatDate(lastBar.date)}</span>
            </p>
          </div>
          <div className="text-right">
            <div
              className="font-mono text-3xl font-semibold tabular-nums"
              style={{ color: change >= 0 ? COLORS.up : COLORS.down }}
            >
              {formatPrice(lastBar.close)}
            </div>
            <div
              className="mt-1 font-mono text-xs tabular-nums"
              style={{ color: change >= 0 ? COLORS.up : COLORS.down }}
            >
              {formatPct(changePct)}{" "}
              <span className="text-slate-500">
                ({change >= 0 ? "+" : "-"}
                {formatPrice(Math.abs(change))} pts)
              </span>
            </div>
          </div>
        </div>
        {firstInstitutional && (
          <span className="mt-3 block border-t border-white/[0.06] pt-2 text-[10px] text-slate-600">
            Institutional data from {formatDate(firstInstitutional)} · NSE
            (cash)
          </span>
        )}
        <div className="flex items-center pt-2.5">
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-x-5 overflow-x-auto hide-scrollbar">
            {LEGEND.map((item) => (
              <span
                key={item.label}
                className="flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500"
              >
                <span
                  className="inline-block h-2 w-2 rounded-[2px]"
                  style={{ background: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </header>

      <section className="w-full border-t overflow-x-auto border-white/[0.06] bg-[#0d1219]/70 py-2">
        <div className="-mr-5  flex w-max min-w-full items-center gap-x-6 overflow-x-auto whitespace-nowrap px-5 pb-1 font-mono text-[11px] hide-scrollbar">
          <Stat label="Date" value={formatDate(active.date)} valueColor={COLORS.text} />
          <Stat label="Open" value={formatPrice(active.open)} />
          <Stat label="High" value={formatPrice(active.high)} valueColor={COLORS.up} />
          <Stat label="Low" value={formatPrice(active.low)} valueColor={COLORS.down} />
          <Stat label="Close" value={formatPrice(active.close)} />
          <Stat label="Volume" value={formatVolume(active.volume)} />
          <span className="hidden h-4 w-px bg-white/10 sm:block" />
          <Stat
            label="FII"
            value={active.fii !== null ? formatCr(active.fii) : "—"}
            valueColor={activeFiiColor}
          />
          <Stat
            label="DII"
            value={active.dii !== null ? formatCr(active.dii) : "—"}
            valueColor={activeDiiColor}
          />
          <Stat
            label="FII + DII"
            value={active.net !== null ? formatCr(active.net) : "—"}
            valueColor={activeNetColor}
          />
        </div>
      </section>

      <div className="relative min-h-0 flex-1 px-5 pb-4">
        <div ref={containerRef} className="relative h-full w-full" />
        {paneTops.length === PANE_LABELS.length &&
          paneTops.map((top, i) => (
            <span
              key={PANE_LABELS[i]}
              className="pointer-events-none absolute left-8 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500/80"
              style={{ top: top + 8 }}
            >
              {PANE_LABELS[i]}
            </span>
          ))}
      </div>
    </main>
  );
}



function Stat({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[9px] uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span
        className="tabular-nums text-slate-200"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
    </span>
  );
}
