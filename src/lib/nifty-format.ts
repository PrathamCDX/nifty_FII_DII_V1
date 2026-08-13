export const COLORS = {
  bg: "#0a0e13",
  panel: "#0d1219",
  separator: "rgba(148,163,184,0.10)",
  separatorHover: "rgba(148,163,184,0.22)",
  grid: "rgba(148,163,184,0.07)",
  text: "#9aa4b2",
  textDim: "#5b6675",
  crosshairLine: "rgba(148,163,184,0.28)",
  crosshairLabel: "#1e293b",
  up: "#16c784",
  down: "#ea3943",
  volumeUp: "rgba(22,199,132,0.40)",
  volumeDown: "rgba(234,57,67,0.40)",
  fiiPos: "#5b8cff",
  fiiNeg: "#334f8f",
  diiPos: "#f5a623",
  diiNeg: "#96631b",
  netPos: "#16c784",
  netNeg: "#ea3943",
  zeroLine: "rgba(148,163,184,0.40)",
};

const GROUPING = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const GROUPING_1 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const PERCENT = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const DAY_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return DAY_DATE.format(new Date(y, m - 1, d));
}

export function formatPrice(value: number): string {
  return GROUPING.format(value);
}

export function formatVolume(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return trim((value / 1e9).toFixed(1)) + "B";
  if (abs >= 1e6) return trim((value / 1e6).toFixed(1)) + "M";
  if (abs >= 1e3) return trim((value / 1e3).toFixed(1)) + "K";
  return GROUPING.format(value);
}

function trim(value: string): string {
  return value.replace(/\.0$/, "");
}

export function formatCr(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}₹${GROUPING.format(Math.abs(value))} Cr`;
}

export function formatCrAxis(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? "" : "-";
  if (abs >= 1000) return `${sign}${trim((abs / 1000).toFixed(1))}K`;
  return `${sign}${GROUPING_1.format(abs)}`;
}

export function formatPct(value: number): string {
  return `${value >= 0 ? "+" : "-"}${PERCENT.format(Math.abs(value))}%`;
}
