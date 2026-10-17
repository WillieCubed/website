import { readFile } from 'node:fs/promises';

import { isMain } from '../shared/command.mts';

const repository = 'WillieCubed/website';
const origin = 'https://willie.page';
const appId = 85455;
const checkName = 'Workers Builds: willie-page';
const validSha = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const validId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

interface Check {
  id: number;
  name: string;
  app?: { id?: number; slug?: string };
  head_sha: string;
  check_suite?: { id?: number };
  status: string;
  conclusion: string | null;
}
interface Options {
  eventName: string;
  event: { action?: string; check_run?: { id?: number } };
  repository: string;
  ref: string;
  githubToken: string;
  productionSecret: string;
  fetch?: typeof fetch;
  log?: (record: Record<string, unknown>) => void;
}
interface LiveRevision {
  sha?: unknown;
  runtime?: unknown;
}
type Result =
  | { status: 'ignored' }
  | { status: 'notified' | 'superseded'; sha: string };

class PublishError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
const fail = (code: string): never => {
  throw new PublishError(code);
};
const matchingCheck = (check: Check): boolean =>
  check?.app?.id === appId &&
  check.app.slug === 'cloudflare-workers-and-pages' &&
  check.name === checkName;

function supportedEvent(options: Options): boolean {
  if (options.repository !== repository) return false;
  if (options.eventName === 'workflow_dispatch')
    return options.ref === 'refs/heads/main';
  return (
    options.eventName === 'check_run' &&
    options.event?.action === 'completed' &&
    validId(options.event.check_run?.id)
  );
}

class Publisher {
  options: Options;
  request: typeof fetch;
  log: (record: Record<string, unknown>) => void;

  constructor(options: Options) {
    this.options = options;
    this.request = options.fetch ?? fetch;
    this.log = options.log ?? ((record) => console.log(JSON.stringify(record)));
  }

  async getGithub<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await this.request(
        `https://api.github.com/repos/${repository}/${path}`,
        {
          headers: {
            Authorization: `Bearer ${this.options.githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          redirect: 'error',
          signal: AbortSignal.timeout(10_000),
        }
      );
    } catch {
      return fail('github_network_error');
    }
    this.log({ phase: 'github', http_status: response.status });
    if (!response.ok) fail('github_http_error');
    try {
      return (await response.json()) as T;
    } catch {
      return fail('github_json_error');
    }
  }

  async mainHead(): Promise<string> {
    const branch = await this.getGithub<{ commit?: { sha?: string } }>(
      'branches/main'
    );
    if (!validSha(branch?.commit?.sha)) return fail('github_revision_invalid');
    return branch.commit.sha;
  }

  async selectCheck(): Promise<Check> {
    if (this.options.eventName !== 'workflow_dispatch') {
      const id = this.options.event.check_run!.id;
      const check = await this.getGithub<Check>(`check-runs/${id}`);
      if (check?.id !== id) fail('deployment_check_invalid');
      return check;
    }
    const head = await this.mainHead();
    const checks = await this.getGithub<{ check_runs?: Check[] }>(
      `commits/${head}/check-runs?app_id=${appId}&filter=latest&per_page=100`
    );
    const match = checks?.check_runs?.find(matchingCheck);
    if (!match) return fail('deployment_check_missing');
    if (match.head_sha !== head) fail('deployment_revision_invalid');
    return match;
  }

  async productionCheck(check: Check): Promise<boolean> {
    if (!matchingCheck(check)) return false;
    if (check.status !== 'completed') fail('deployment_not_ready');
    if (check.conclusion !== 'success') fail('deployment_failed');
    if (!validSha(check.head_sha) || !validId(check.check_suite?.id))
      fail('deployment_revision_invalid');
    const suite = await this.getGithub<{
      head_branch?: string;
      head_sha?: string;
    }>(`check-suites/${check.check_suite!.id}`);
    if (suite?.head_branch !== 'main') return false;
    if (suite.head_sha !== check.head_sha) fail('deployment_revision_invalid');
    this.log({
      phase: 'deployment',
      expected_sha: check.head_sha,
      check_id: check.id,
    });
    return true;
  }

  async superseded(sha: string): Promise<boolean> {
    const head = await this.mainHead();
    if (head === sha) return false;
    this.log({ phase: 'superseded', expected_sha: sha, main_sha: head });
    return true;
  }

  async readRevision(sha: string): Promise<LiveRevision> {
    let response: Response;
    try {
      response = await this.request(
        `${origin}/api/indieweb/revision?expected=${sha}`,
        {
          headers: { 'Cache-Control': 'no-cache, no-store' },
          redirect: 'error',
          signal: AbortSignal.timeout(10_000),
        }
      );
    } catch {
      return fail('revision_network_error');
    }
    this.log({
      phase: 'revision',
      http_status: response.status,
      expected_sha: sha,
    });
    if (response.status !== 200) fail('revision_http_error');
    let live: LiveRevision;
    try {
      live = await response.json();
    } catch {
      return fail('revision_json_error');
    }
    this.log({
      phase: 'revision',
      http_status: response.status,
      expected_sha: sha,
      observed_sha: validSha(live?.sha) ? live.sha : null,
      runtime:
        live?.runtime === 'cloudflare-workers' ? live.runtime : 'invalid',
    });
    return live;
  }

  async notify(sha: string): Promise<Result> {
    if (!this.options.productionSecret) fail('notification_secret_missing');
    let response: Response;
    try {
      response = await this.request(`${origin}/api/indieweb/notify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.productionSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sha, atprotoRequired: true }),
        redirect: 'error',
        signal: AbortSignal.timeout(300_000),
      });
    } catch {
      return fail('notification_network_error');
    }
    this.log({
      phase: 'notification',
      http_status: response.status,
      expected_sha: sha,
    });
    // Never retry a POST: a failed response can follow partial publishing effects.
    if (response.status === 409) {
      if (await this.superseded(sha)) return { status: 'superseded', sha };
      fail('notification_conflict');
    }
    if (response.status !== 200) fail('notification_failed');
    return { status: 'notified', sha };
  }

  async run(): Promise<Result> {
    if (!supportedEvent(this.options)) return { status: 'ignored' };
    if (!this.options.githubToken) fail('github_token_missing');
    const check = await this.selectCheck();
    if (!(await this.productionCheck(check))) return { status: 'ignored' };
    const sha = check.head_sha;
    if (await this.superseded(sha)) return { status: 'superseded', sha };
    const live = await this.readRevision(sha);
    // A push while checking the public alias makes this run obsolete, not broken.
    if (await this.superseded(sha)) return { status: 'superseded', sha };
    if (live?.runtime !== 'cloudflare-workers') fail('revision_runtime_error');
    if (live?.sha !== sha) fail('revision_mismatch');
    return this.notify(sha);
  }
}

/**
 * Make one POST per invocation after verifying a successful production build.
 * No durable receipt exists: a separate rebuild or explicit rerun may publish again.
 */
export async function publishAfterDeployment(
  options: Options
): Promise<Result> {
  return new Publisher(options).run();
}

if (isMain(import.meta.url)) {
  try {
    const event = JSON.parse(
      await readFile(process.env.GITHUB_EVENT_PATH ?? '', 'utf8')
    );
    const result = await publishAfterDeployment({
      event,
      eventName: process.env.GITHUB_EVENT_NAME ?? '',
      repository: process.env.GITHUB_REPOSITORY ?? '',
      ref: process.env.GITHUB_REF ?? '',
      githubToken: process.env.GITHUB_TOKEN ?? '',
      productionSecret: process.env.PRODUCTION_SECRET ?? '',
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(
      JSON.stringify({
        status: 'failed',
        code:
          error instanceof PublishError
            ? error.code
            : 'publisher_configuration_error',
      })
    );
    process.exitCode = 1;
  }
}
