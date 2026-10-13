#!/usr/bin/env node
/** Read-only Neon Free usage check for the website's two database projects. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const PROJECTS = [
  'icy-sound-09771903', // production
  'shiny-scene-02090850', // isolated acceptance
] as const;
const FREE_CU_HOURS = 100;
const ACTION_CU_HOURS = 80;
const ACTION_STORAGE_BYTES = 800_000_000;

interface Sample {
  id: string;
  name: string;
  computeTimeSeconds: number;
  storageBytes: number;
  periodStart: string;
  periodEnd: string;
}

interface Snapshot {
  observedAt: string;
  samples: Sample[];
}

const { values } = parseArgs({
  options: {
    previous: { type: 'string' },
    output: { type: 'string' },
  },
});
const now = new Date();
const previous: Snapshot | undefined = values.previous
  ? JSON.parse(await readFile(values.previous, 'utf8'))
  : undefined;

function readProject(id: string): Sample {
  let json: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      json = execFileSync(
        'npx',
        ['-y', 'neonctl@latest', 'projects', 'get', id, '--output', 'json'],
        { encoding: 'utf8' }
      );
      break;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  assert(json, `Neon returned an empty project response for ${id}`);
  const project = JSON.parse(json);
  for (const key of [
    'compute_time_seconds',
    'synthetic_storage_size',
    'consumption_period_start',
    'consumption_period_end',
  ]) {
    assert(project[key] !== undefined, `Neon omitted ${key} for ${id}`);
  }
  return {
    id,
    name: project.name,
    computeTimeSeconds: project.compute_time_seconds,
    storageBytes: project.synthetic_storage_size,
    periodStart: project.consumption_period_start,
    periodEnd: project.consumption_period_end,
  };
}

const samples = PROJECTS.map(readProject);
const results = samples.map((sample) => {
  const cuHours = sample.computeTimeSeconds / 3600;
  const previousSample = previous?.samples.find(
    (entry) => entry.id === sample.id
  );
  let projectedCuHours: number | null = null;
  let dailyCuHours: number | null = null;
  if (
    previousSample?.periodStart === sample.periodStart &&
    previousSample.periodEnd === sample.periodEnd
  ) {
    const elapsedDays =
      (now.getTime() - new Date(previous!.observedAt).getTime()) / 86_400_000;
    const deltaCuHours =
      (sample.computeTimeSeconds - previousSample.computeTimeSeconds) / 3600;
    assert(deltaCuHours >= 0, `${sample.name} usage decreased in one period`);
    // Short intervals exaggerate a single wake-up across the whole month.
    if (elapsedDays >= 0.25) {
      dailyCuHours = deltaCuHours / elapsedDays;
      const remainingDays = Math.max(
        0,
        (new Date(sample.periodEnd).getTime() - now.getTime()) / 86_400_000
      );
      projectedCuHours = cuHours + dailyCuHours * remainingDays;
    }
  }
  const attention: string[] = [];
  if (cuHours >= ACTION_CU_HOURS)
    attention.push('compute usage reached 80 CU-hours');
  if (projectedCuHours !== null && projectedCuHours >= ACTION_CU_HOURS)
    attention.push('current pace projects at least 80 CU-hours');
  if (sample.storageBytes >= ACTION_STORAGE_BYTES)
    attention.push('storage reached 800 MB');
  return {
    ...sample,
    cuHours,
    storageMb: sample.storageBytes / 1_000_000,
    dailyCuHours,
    projectedCuHours,
    attention,
  };
});

const report = {
  observedAt: now.toISOString(),
  freeCuHoursPerProject: FREE_CU_HOURS,
  actionCuHours: ACTION_CU_HOURS,
  results,
  samples,
};
if (values.output) {
  const output = resolve(values.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
}
console.log(JSON.stringify(report, null, 2));
if (results.some((result) => result.attention.length > 0)) process.exitCode = 2;
