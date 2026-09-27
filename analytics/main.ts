import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commitsCard, donutCard, profileCard, statsCard } from "./cards";
import { fetchAnalytics } from "./github";
import { THEMES } from "./theme";

const OUTPUT_DIR = process.env.OUTPUT_DIR ?? "dist";
const token = process.env.GITHUB_TOKEN;
const login = process.env.GITHUB_USER;

if (!token || !login) {
  console.error("Set GITHUB_TOKEN and GITHUB_USER before running.");
  process.exit(1);
}

const analytics = await fetchAnalytics(token, login);
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
