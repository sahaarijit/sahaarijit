import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commitsCard, donutCard, profileCard, statsCard } from "./cards";
import { fetchAnalytics, isTokenAccepted } from "./github";
import { THEMES } from "./theme";

const OUTPUT_DIR = process.env.OUTPUT_DIR ?? "dist";
const personalToken = process.env.GH_TOKEN;
const fallbackToken = process.env.GITHUB_TOKEN;
const login = process.env.GITHUB_USER;

if (!fallbackToken || !login) {
  console.error("Set GITHUB_TOKEN and GITHUB_USER before running.");
  process.exit(1);
}

// The personal token sees private activity, but it can expire, so fall back to the workflow token
async function pickToken(): Promise<string> {
  if (personalToken && (await isTokenAccepted(personalToken))) {
    console.log("Using GH_TOKEN.");
    return personalToken;
  }
  console.log("GH_TOKEN missing or rejected, using GITHUB_TOKEN.");
  return fallbackToken;
}

const analytics = await fetchAnalytics(await pickToken(), login);
mkdirSync(OUTPUT_DIR, { recursive: true });
let writtenCount = 0;

for (const theme of THEMES) {
  const cards = {
    profile: profileCard(analytics, theme),
    "repos-per-language": donutCard("Top Languages by Repo", analytics.reposPerLanguage, theme),
    "commits-per-language": donutCard("Top Languages by Commit", analytics.commitsPerLanguage, theme),
    stats: statsCard(analytics, theme),
    "commits-per-hour": commitsCard(analytics, theme),
  };
  for (const [cardName, svg] of Object.entries(cards)) {
    writeFileSync(join(OUTPUT_DIR, `analytics-${cardName}-${theme.name}.svg`), svg);
    writtenCount += 1;
  }
}

console.log(`Wrote ${writtenCount} cards to ${OUTPUT_DIR}/`);
