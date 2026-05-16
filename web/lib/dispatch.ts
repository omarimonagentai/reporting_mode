import "server-only";

const GITHUB_API = "https://api.github.com";

export type DispatchResult =
  | { status: "ok"; workflow_url: string }
  | { status: "error"; message: string };

function getConfig() {
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

/**
 * Trigger the "Run brief" workflow_dispatch for one brief.
 *
 * `filename` is the slug as it appears in the URL (`/briefs/<slug>`),
 * with no path prefix and no `.yml` extension. We wrap it to the
 * `briefs/<slug>.yml` form the workflow input expects.
 *
 * GH Actions workflow_dispatch returns 204 with no body — there is no
 * way to fetch the resulting run id directly. We surface the workflow
 * page URL so the caller can link the user to GitHub's Actions tab;
 * the run will appear there within seconds.
 */
export async function dispatchBriefRun(
  filename: string
): Promise<DispatchResult> {
  const { owner, repo, token } = getConfig();
  const briefPath = `briefs/${filename}.yml`;

  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/run-brief.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { brief: briefPath },
      }),
    }
  );

  if (res.status === 204) {
    return {
      status: "ok",
      workflow_url: `https://github.com/${owner}/${repo}/actions/workflows/run-brief.yml`,
    };
  }

  let message: string;
  try {
    const data = (await res.json()) as { message?: string };
    message = data.message ?? `HTTP ${res.status}`;
  } catch {
    message = `HTTP ${res.status}`;
  }
  return { status: "error", message };
}
