export interface GitHubObject {
  sha: string;
}

export interface GitHubTreeEntry extends GitHubObject {
  path: string;
}

export interface GitHubCheckRun {
  name: string;
  app?: { id: number };
  status: string;
  conclusion: string;
}

export interface GitHubContentsCommitResponse {
  commit?: { sha?: string };
}
