const COMMIT_AUTHOR = {
  name: "Cooltra Reporting Bot",
  email: "reporting-bot@cooltra.local",
} as const;

const BRIEFS_DIR = "briefs";

type RepoConfig = { owner: string; repo: string; token: string };

function getRepoConfig(): RepoConfig {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token) {
    throw new Error(
      "GITHUB_REPO_OWNER, GITHUB_REPO_NAME and GITHUB_TOKEN must be set"
    );
  }
  return { owner, repo, token };
}

async function ghFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const { token } = getRepoConfig();
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

export type BriefFile = {
  filename: string;
  sha: string;
};

export async function listBriefs(): Promise<BriefFile[]> {
  const { owner, repo } = getRepoConfig();
  const res = await ghFetch(
    `/repos/${owner}/${repo}/contents/${BRIEFS_DIR}`
  );
  if (!res.ok) {
    throw new Error(`GitHub list contents failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as Array<{
    name: string;
    sha: string;
    type: string;
  }>;
  return data
    .filter((entry) => entry.type === "file" && entry.name.endsWith(".yml"))
    .map((entry) => ({
      filename: entry.name.replace(/\.yml$/, ""),
      sha: entry.sha,
    }));
}

export type BriefBlob = {
  content: string;
  sha: string;
};

export async function readBrief(filename: string): Promise<BriefBlob> {
  const { owner, repo } = getRepoConfig();
  const res = await ghFetch(
    `/repos/${owner}/${repo}/contents/${BRIEFS_DIR}/${filename}.yml`
  );
  if (res.status === 404) {
    throw new BriefNotFoundError(filename);
  }
  if (!res.ok) {
    throw new Error(`GitHub read failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    content: string;
    encoding: string;
    sha: string;
  };
  if (data.encoding !== "base64") {
    throw new Error(`Unexpected GitHub encoding: ${data.encoding}`);
  }
  return {
    content: Buffer.from(data.content, "base64").toString("utf8"),
    sha: data.sha,
  };
}

export async function writeBrief(
  filename: string,
  content: string,
  sha?: string
): Promise<{ sha: string }> {
  const { owner, repo } = getRepoConfig();
  const message = sha
    ? `Update brief: ${filename}`
    : `Create brief: ${filename}`;
  const body = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    sha,
    author: COMMIT_AUTHOR,
    committer: COMMIT_AUTHOR,
  };
  const res = await ghFetch(
    `/repos/${owner}/${repo}/contents/${BRIEFS_DIR}/${filename}.yml`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (res.status === 422 && !sha) {
    throw new BriefAlreadyExistsError(filename);
  }
  if (!res.ok) {
    throw new Error(`GitHub write failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { content: { sha: string } };
  return { sha: data.content.sha };
}

export async function deleteBrief(filename: string, sha: string): Promise<void> {
  const { owner, repo } = getRepoConfig();
  const body = {
    message: `Delete brief: ${filename}`,
    sha,
    author: COMMIT_AUTHOR,
    committer: COMMIT_AUTHOR,
  };
  const res = await ghFetch(
    `/repos/${owner}/${repo}/contents/${BRIEFS_DIR}/${filename}.yml`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    throw new Error(`GitHub delete failed: ${res.status} ${await res.text()}`);
  }
}

export class BriefNotFoundError extends Error {
  constructor(filename: string) {
    super(`Brief not found: ${filename}`);
    this.name = "BriefNotFoundError";
  }
}

export class BriefAlreadyExistsError extends Error {
  constructor(filename: string) {
    super(`Brief already exists: ${filename}`);
    this.name = "BriefAlreadyExistsError";
  }
}
