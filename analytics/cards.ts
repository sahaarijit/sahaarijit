import type { Analytics, LanguageShare } from "./github";
import { FONT_CSS, MONO, SERIF, type Theme } from "./theme";

// Card frame
const WIDE_WIDTH = 700;
const NARROW_WIDTH = 346;
const CARD_HEIGHT = 200;
const CARD_RADIUS = 4;
const HAIRLINE_OFFSET = 0.5;
const PAD = 24;
const TITLE_Y = 40;
const FIRST_ROW_Y = 76;
const ROW_GAP = 26;

// Type scale from the Amber Mono spec: card-title, small, micro, eyebrow tracking
const TITLE_SIZE = 19;
const TEXT_SIZE = 13;
const MICRO_SIZE = 11;
const MEDIUM_WEIGHT = 500;
const EYEBROW_TRACKING = "0.08em";

// Axis labels sit beside or under a chart
const AXIS_LABEL_GAP = 8;
const AXIS_LABEL_BASELINE_SHIFT = 4;

// Profile card
const PROFILE_CHART = { left: 330, top: 60, bottom: 158 };
const MONTH_LABEL_DROP = 22;
const MONTH_LABEL_EVERY = 2;
const CURVE_TENSION = 0.18;
const CURVE_STROKE = 1.5;
const AREA_OPACITY = 0.08;
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

// Language cards
const MAX_SLICES = 5;
const DONUT_RADIUS = 48;
const DONUT_STROKE = 24;
const DONUT_CENTER_Y = 118;
const SLICE_GAP = 2;
const LEGEND_ROW_GAP = 22;
const SWATCH_SIZE = 10;
const SWATCH_RADIUS = 2;
const LEGEND_NAME_INDENT = 18;
const LEGEND_PERCENT_X = 150;

// Stats card
const STATS_FIRST_ROW_Y = 68;
const STATS_RULE_DROP = 9.5;

// Commits card
const COMMITS_CHART = { left: 48, top: 64, bottom: 164 };
const HOUR_LABEL_DROP = 18;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const UTC_OFFSET_MINUTES = 330;
const UTC_OFFSET_LABEL = "UTC +5:30";
const HOUR_TICKS = [0, 6, 12, 18, 23];
const BAR_GAP = 3;

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}

function card(width: number, theme: Theme, title: string, body: string): string {
  const style = `${FONT_CSS}
    .title{font-family:${SERIF};font-weight:${MEDIUM_WEIGHT};font-size:${TITLE_SIZE}px;fill:${theme.ink}}
    .text{font-family:${MONO};font-size:${TEXT_SIZE}px;fill:${theme.muted}}
    .strong{font-weight:${MEDIUM_WEIGHT};fill:${theme.ink}}
    .micro{font-family:${MONO};font-size:${MICRO_SIZE}px;fill:${theme.faint}}
    .eyebrow{letter-spacing:${EYEBROW_TRACKING}}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${CARD_HEIGHT}" viewBox="0 0 ${width} ${CARD_HEIGHT}">
<style>${style}</style>
<rect x="${HAIRLINE_OFFSET}" y="${HAIRLINE_OFFSET}" width="${width - 2 * HAIRLINE_OFFSET}" height="${CARD_HEIGHT - 2 * HAIRLINE_OFFSET}" rx="${CARD_RADIUS}" fill="${theme.surface}" stroke="${theme.border}"/>
<text class="title" x="${PAD}" y="${TITLE_Y}">${escapeXml(title)}</text>
${body}
</svg>`;
}

function hairline(x1: number, x2: number, y: number, theme: Theme): string {
  return `<line x1="${x1}" y1="${y + HAIRLINE_OFFSET}" x2="${x2}" y2="${y + HAIRLINE_OFFSET}" stroke="${theme.border}"/>`;
}

function axisRange(chart: { left: number; top: number; bottom: number }, peak: number): string {
  const x = chart.left - AXIS_LABEL_GAP;
  return `<text class="micro" x="${x}" y="${chart.top + AXIS_LABEL_BASELINE_SHIFT}" text-anchor="end">${formatCount(peak)}</text>
<text class="micro" x="${x}" y="${chart.bottom + AXIS_LABEL_BASELINE_SHIFT}" text-anchor="end">0</text>`;
}

function monthlyTotals(days: Analytics["dailyContributions"]) {
  const months = new Map<string, { date: Date; count: number }>();
  for (const day of days) {
    const key = `${day.date.getUTCFullYear()}-${day.date.getUTCMonth()}`;
    const month = months.get(key) ?? { date: day.date, count: 0 };
    month.count += day.count;
    months.set(key, month);
  }
  return [...months.values()];
}

// Cardinal spline, with control points clamped so the curve never dips below the baseline
function smoothPath(points: { x: number; y: number }[], top: number, bottom: number): string {
  const clampY = (y: number) => Math.min(bottom, Math.max(top, y));
  const segments = points.slice(1).map((point, index) => {
    const before = points[index - 1] ?? points[index];
    const start = points[index];
    const after = points[index + 2] ?? point;
    const control1 = { x: start.x + (point.x - before.x) * CURVE_TENSION, y: clampY(start.y + (point.y - before.y) * CURVE_TENSION) };
    const control2 = { x: point.x - (after.x - start.x) * CURVE_TENSION, y: clampY(point.y - (after.y - start.y) * CURVE_TENSION) };
    return `C${control1.x},${control1.y} ${control2.x},${control2.y} ${point.x},${point.y}`;
  });
  return `M${points[0].x},${points[0].y} ${segments.join(" ")}`;
}

function monthLabels(months: { date: Date }[], xOf: (index: number) => number, y: number): string {
  return months
    .map((month, index) => {
      if (index % MONTH_LABEL_EVERY !== 0) return "";
      const year = String(month.date.getUTCFullYear()).slice(2);
      const monthNumber = String(month.date.getUTCMonth() + 1).padStart(2, "0");
      return `<text class="micro" x="${xOf(index)}" y="${y}" text-anchor="middle">${year}/${monthNumber}</text>`;
    })
    .join("");
}

export function profileCard(analytics: Analytics, theme: Theme): string {
  const chart = { ...PROFILE_CHART, right: WIDE_WIDTH - PAD };
  const months = monthlyTotals(analytics.dailyContributions);
  const peak = Math.max(1, ...months.map((month) => month.count));
  const xOf = (index: number) => chart.left + (index / (months.length - 1)) * (chart.right - chart.left);
  const yOf = (count: number) => chart.bottom - (count / peak) * (chart.bottom - chart.top);
  const points = months.map((month, index) => ({ x: xOf(index), y: yOf(month.count) }));
  const curve = smoothPath(points, chart.top, chart.bottom);
  const area = `${curve} L${chart.right},${chart.bottom} L${chart.left},${chart.bottom} Z`;

  const yearsOnGitHub = Math.floor((Date.now() - analytics.createdAt.getTime()) / MS_PER_YEAR);
  const rows = [
    `<tspan class="strong">${formatCount(analytics.totalContributions)}</tspan> contributions`,
    `<tspan class="strong">${analytics.publicRepos}</tspan> public repos`,
    `joined <tspan class="strong">${yearsOnGitHub} years</tspan> ago`,
    analytics.email && escapeXml(analytics.email),
  ].filter(Boolean);

  const body = `
${rows.map((row, index) => `<text class="text" x="${PAD}" y="${FIRST_ROW_Y + index * ROW_GAP}">${row}</text>`).join("")}
<text class="micro eyebrow" x="${chart.right}" y="${TITLE_Y}" text-anchor="end">CONTRIBUTIONS IN THE LAST YEAR</text>
${axisRange(chart, peak)}
<path d="${area}" fill="${theme.ink}" fill-opacity="${AREA_OPACITY}"/>
<path d="${curve}" fill="none" stroke="${theme.ink}" stroke-width="${CURVE_STROKE}"/>
${hairline(chart.left, chart.right, chart.bottom, theme)}
${monthLabels(months, xOf, chart.bottom + MONTH_LABEL_DROP)}`;
  return card(WIDE_WIDTH, theme, `${analytics.login} (${analytics.name})`, body);
}

function topSlices(shares: LanguageShare[]): LanguageShare[] {
  if (shares.length <= MAX_SLICES) return shares;
  const kept = shares.slice(0, MAX_SLICES - 1);
  const otherTotal = shares.slice(MAX_SLICES - 1).reduce((sum, share) => sum + share.value, 0);
  return [...kept, { name: "Other", value: otherTotal }];
}

export function donutCard(title: string, shares: LanguageShare[], theme: Theme): string {
  const slices = topSlices(shares);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const circumference = 2 * Math.PI * DONUT_RADIUS;
  const gap = slices.length > 1 ? SLICE_GAP : 0;
  const center = { x: NARROW_WIDTH - PAD - DONUT_RADIUS - DONUT_STROKE / 2, y: DONUT_CENTER_Y };

  let offset = 0;
  const rings = slices.map((slice, index) => {
    const length = (slice.value / total) * circumference;
    const ring = `<circle cx="${center.x}" cy="${center.y}" r="${DONUT_RADIUS}" fill="none" stroke="${theme.chartTones[index]}" stroke-width="${DONUT_STROKE}" stroke-dasharray="${Math.max(0, length - gap)} ${circumference}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${center.x} ${center.y})"/>`;
    offset += length;
    return ring;
  });

  const legend = slices.map((slice, index) => {
    const y = FIRST_ROW_Y + index * LEGEND_ROW_GAP;
    const percent = Math.round((slice.value / total) * 100);
    return `<rect x="${PAD}" y="${y - SWATCH_SIZE}" width="${SWATCH_SIZE}" height="${SWATCH_SIZE}" rx="${SWATCH_RADIUS}" fill="${theme.chartTones[index]}" stroke="${theme.border}"/>
<text class="text" x="${PAD + LEGEND_NAME_INDENT}" y="${y}">${escapeXml(slice.name)}</text>
<text class="micro" x="${PAD + LEGEND_PERCENT_X}" y="${y}" text-anchor="end">${percent}%</text>`;
  });

  return card(NARROW_WIDTH, theme, title, `${rings.join("")}${legend.join("")}`);
}

export function statsCard(analytics: Analytics, theme: Theme): string {
  const rows = [
    ["Total stars", analytics.totalStars],
    ["Total commits", analytics.totalCommits],
    ["Total PRs", analytics.totalPullRequests],
    ["Total issues", analytics.totalIssues],
    ["Contributed to", analytics.contributedTo],
  ] as const;

  const body = rows.map(([label, value], index) => {
    const y = STATS_FIRST_ROW_Y + index * ROW_GAP;
    const isLastRow = index === rows.length - 1;
    const rule = isLastRow ? "" : hairline(PAD, NARROW_WIDTH - PAD, y + STATS_RULE_DROP, theme);
    return `<text class="text" x="${PAD}" y="${y}">${label}</text>
<text class="text strong" x="${NARROW_WIDTH - PAD}" y="${y}" text-anchor="end">${formatCount(value)}</text>${rule}`;
  });

  return card(NARROW_WIDTH, theme, "Stats", body.join(""));
}

function commitsPerHour(commitDates: Date[]): number[] {
  const hours = new Array(HOURS_PER_DAY).fill(0);
  for (const date of commitDates) {
    const localMinutes = date.getUTCHours() * MINUTES_PER_HOUR + date.getUTCMinutes() + UTC_OFFSET_MINUTES;
    const hour = Math.floor(localMinutes / MINUTES_PER_HOUR) % HOURS_PER_DAY;
    hours[hour] += 1;
  }
  return hours;
}

export function commitsCard(analytics: Analytics, theme: Theme): string {
  const chart = { ...COMMITS_CHART, right: NARROW_WIDTH - PAD };
  const hours = commitsPerHour(analytics.commitDates);
  const peak = Math.max(1, ...hours);
  const slot = (chart.right - chart.left) / HOURS_PER_DAY;

  const bars = hours.map((count, hour) => {
    const height = (count / peak) * (chart.bottom - chart.top);
    return `<rect x="${chart.left + hour * slot + BAR_GAP / 2}" y="${chart.bottom - height}" width="${slot - BAR_GAP}" height="${height}" fill="${theme.muted}"/>`;
  });
  const ticks = HOUR_TICKS.map((hour) => {
    const slotCenter = chart.left + (hour + 0.5) * slot;
    return `<text class="micro" x="${slotCenter}" y="${chart.bottom + HOUR_LABEL_DROP}" text-anchor="middle">${hour}</text>`;
  });

  const body = `${bars.join("")}
${hairline(chart.left, chart.right, chart.bottom, theme)}
${axisRange(chart, peak)}
${ticks.join("")}`;
  return card(NARROW_WIDTH, theme, `Commits (${UTC_OFFSET_LABEL})`, body);
}
