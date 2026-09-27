// Queries adapted from vn7n24fzkq/github-profile-summary-cards (MIT)

const GRAPHQL_URL = "https://api.github.com/graphql";
const PAGE_SIZE = 100;
const MAX_COMMIT_REPOS = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;

export interface LanguageShare {
  name: string;
  value: number;
}

export interface Analytics {
  login: string;
  name: string;
  email: string;
  createdAt: Date;
  publicRepos: number;
  totalContributions: number;
  totalCommits: number;
  totalStars: number;
  totalPullRequests: number;
  totalIssues: number;
  contributedTo: number;
  dailyContributions: { date: Date; count: number }[];
  reposPerLanguage: LanguageShare[];
  commitsPerLanguage: LanguageShare[];
  commitDates: Date[];
}

const PROFILE_QUERY = `
query Profile($login: String!) {
  user(login: $login) {
    id login name email createdAt
    contributionsCollection {
      contributionYears
      contributionCalendar { weeks { contributionDays { contributionCount date } } }
    }
    repositoriesContributedTo(first: 1, includeUserRepositories: true, privacy: PUBLIC,
      contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) { totalCount }
    pullRequests(first: 1) { totalCount }
    issues(first: 1) { totalCount }
  }
}`;

const REPOS_QUERY = `
query Repos($login: String!, $cursor: String) {
  user(login: $login) {
    repositories(first: ${PAGE_SIZE}, after: $cursor, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      totalCount
      nodes { stargazerCount primaryLanguage { name } }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

const YEAR_QUERY = `
query Year($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      contributionCalendar { totalContributions }
      commitContributionsByRepository(maxRepositories: ${MAX_COMMIT_REPOS}) {
        repository { primaryLanguage { name } }
        contributions { totalCount }
      }
    }
  }
}`;

const COMMITTED_REPOS_QUERY = `
query CommittedRepos($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository(maxRepositories: ${MAX_COMMIT_REPOS}) {
        repository { name owner { login } }
      }
    }
  }
}`;

// One repo per request, because asking for every repo's history at once times out
const COMMIT_TIMES_QUERY = `
query CommitTimes($owner: String!, $name: String!, $userId: ID!, $since: GitTimestamp!) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef { target { ... on Commit {
      history(first: ${PAGE_SIZE}, since: $since, author: { id: $userId }) { nodes { authoredDate } }
    } } }
  }
}`;

// GraphQL answers are untyped JSON, so callers read their fields as `any`
async function queryGitHub(token: string, query: string, variables: Record<string, unknown>) {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`GitHub API answered ${response.status}: ${await response.text()}`);

  const payload = await response.json();
  if (payload.errors) throw new Error(`GitHub API errors: ${JSON.stringify(payload.errors)}`);
  return payload.data;
}

function addToTally(tally: Map<string, number>, name: string | undefined, amount: number) {
  if (!name) return;
  tally.set(name, (tally.get(name) ?? 0) + amount);
}

function sortTally(tally: Map<string, number>): LanguageShare[] {
  return [...tally].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

async function fetchRepos(token: string, login: string) {
  const languageTally = new Map<string, number>();
  let totalStars = 0;
  let publicRepos = 0;
  let cursor: string | null = null;

  do {
    const { user: { repositories } } = await queryGitHub(token, REPOS_QUERY, { login, cursor });
    publicRepos = repositories.totalCount;
    for (const repo of repositories.nodes) {
      totalStars += repo.stargazerCount;
      addToTally(languageTally, repo.primaryLanguage?.name, 1);
    }
    cursor = repositories.pageInfo.hasNextPage ? repositories.pageInfo.endCursor : null;
  } while (cursor);

  return { totalStars, publicRepos, reposPerLanguage: sortTally(languageTally) };
}

async function fetchYearTotals(token: string, login: string, years: number[]) {
  const languageTally = new Map<string, number>();
  let totalContributions = 0;
  let totalCommits = 0;

  for (const year of years) {
    const { user: { contributionsCollection } } = await queryGitHub(token, YEAR_QUERY, {
      login,
      from: `${year}-01-01T00:00:00Z`,
      to: `${year}-12-31T23:59:59Z`,
    });
    totalContributions += contributionsCollection.contributionCalendar.totalContributions;
    totalCommits += contributionsCollection.totalCommitContributions;
    for (const entry of contributionsCollection.commitContributionsByRepository) {
      addToTally(languageTally, entry.repository.primaryLanguage?.name, entry.contributions.totalCount);
    }
  }

  return { totalContributions, totalCommits, commitsPerLanguage: sortTally(languageTally) };
}

async function fetchCommitDates(token: string, login: string, userId: string): Promise<Date[]> {
  const now = new Date();
  const yearAgo = new Date(now.getTime() - YEAR_MS);
  const { user: { contributionsCollection } } = await queryGitHub(token, COMMITTED_REPOS_QUERY, {
    login,
    from: yearAgo.toISOString(),
    to: now.toISOString(),
  });

  const commitDates: Date[] = [];
  for (const { repository } of contributionsCollection.commitContributionsByRepository) {
    const { repository: { defaultBranchRef } } = await queryGitHub(token, COMMIT_TIMES_QUERY, {
      owner: repository.owner.login,
      name: repository.name,
      userId,
      since: yearAgo.toISOString(),
    });
    const commits = defaultBranchRef?.target.history.nodes ?? [];
    commitDates.push(...commits.map((commit: any) => new Date(commit.authoredDate)));
  }
  return commitDates;
}

export async function fetchAnalytics(token: string, login: string): Promise<Analytics> {
  const { user } = await queryGitHub(token, PROFILE_QUERY, { login });
  const calendar = user.contributionsCollection;
  const dailyContributions = calendar.contributionCalendar.weeks.flatMap((week: any) =>
    week.contributionDays.map((day: any) => ({ date: new Date(day.date), count: day.contributionCount })),
  );

  const [repos, yearTotals, commitDates] = await Promise.all([
    fetchRepos(token, login),
    fetchYearTotals(token, login, calendar.contributionYears),
    fetchCommitDates(token, login, user.id),
  ]);

  return {
    login: user.login,
    name: user.name ?? user.login,
    email: user.email ?? "",
    createdAt: new Date(user.createdAt),
    totalPullRequests: user.pullRequests.totalCount,
    totalIssues: user.issues.totalCount,
    contributedTo: user.repositoriesContributedTo.totalCount,
    dailyContributions,
    commitDates,
    ...repos,
    ...yearTotals,
  };
}
