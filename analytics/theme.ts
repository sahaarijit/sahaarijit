import { readFileSync } from "node:fs";
import { join } from "node:path";

// Amber Mono tokens from the portfolio design system. Chart tones are solid
// versions of the token ramp so every slice stays tied to a spec color.
export interface Theme {
  name: "light" | "dark";
  surface: string;
  ink: string;
  muted: string;
  faint: string;
  border: string;
  chartTones: string[];
}

export const LIGHT: Theme = {
  name: "light",
  surface: "#f7f4ec",
  ink: "#141414",
  muted: "#5c5850",
  faint: "#8a857a",
  border: "rgba(20, 20, 20, 0.12)",
  chartTones: ["#141414", "#5c5850", "#8a857a", "#b0aca3", "#dcd8cf"],
};

export const DARK: Theme = {
  name: "dark",
  surface: "#1c1c1c",
  ink: "#e8e3d8",
  muted: "#98938a",
  faint: "#6e6a62",
  border: "#2a2a2a",
  chartTones: ["#e8e3d8", "#98938a", "#6e6a62", "#4a463f", "#3a3834"],
};

export const THEMES = [LIGHT, DARK];

export const MONO = "'Amber Mono', 'SF Mono', ui-monospace, monospace";
export const SERIF = "'Amber Serif', Georgia, serif";

const FONT_DIR = join(import.meta.dir, "..", "assets", "fonts");

const FONT_FACES = [
  { family: "Amber Mono", weight: 400, file: "JetBrainsMono-Regular.woff2" },
  { family: "Amber Mono", weight: 500, file: "JetBrainsMono-Medium.woff2" },
  { family: "Amber Serif", weight: 500, file: "Fraunces-Medium.woff2" },
];

// A README image cannot fetch web fonts, so each face travels inside the SVG
export const FONT_CSS = FONT_FACES.map(({ family, weight, file }) => {
  const encodedFont = readFileSync(join(FONT_DIR, file)).toString("base64");
  return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${encodedFont}) format('woff2');}`;
}).join("");
