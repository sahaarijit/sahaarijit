import { readFileSync, writeFileSync } from "node:fs";
import { DARK, LIGHT } from "./theme";

// The README shows this image at the profile card's width, so frame sizes are scaled to match it
const DISPLAY_WIDTH = 700;
const CARD_RADIUS = 4;
const HAIRLINE_WIDTH = 1;
const BACKGROUND_RECT = /<rect x="0" y="0" width="(\d+)" height="(\d+)" class="fill-bg">/;

const svgPath = process.argv[2];
if (!svgPath) {
  console.error("Pass the 3D contributions SVG path.");
  process.exit(1);
}

const svg = readFileSync(svgPath, "utf8");
const match = svg.match(BACKGROUND_RECT);
if (!match) {
  console.error(`No background rect found in ${svgPath}. The 3D tool's output format may have changed.`);
  process.exit(1);
}

const width = Number(match[1]);
const height = Number(match[2]);
const unitsPerPixel = width / DISPLAY_WIDTH;
const strokeWidth = HAIRLINE_WIDTH * unitsPerPixel;
const inset = strokeWidth / 2;

// Inset by half the stroke so the border is not clipped at the image edge
const framedRect = `<rect x="${inset}" y="${inset}" width="${width - strokeWidth}" height="${height - strokeWidth}" rx="${CARD_RADIUS * unitsPerPixel}" stroke-width="${strokeWidth}" class="fill-bg frame">`;
const frameStyle = `<style>.frame{stroke:${LIGHT.border}}@media (prefers-color-scheme: dark){.frame{stroke:${DARK.border}}}</style>`;

const framedSvg = svg.replace(BACKGROUND_RECT, framedRect).replace("</svg>", `${frameStyle}</svg>`);
writeFileSync(svgPath, framedSvg);
console.log(`Framed ${svgPath}`);
