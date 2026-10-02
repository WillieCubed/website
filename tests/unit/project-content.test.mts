import assert from 'node:assert/strict';
import test from 'node:test';

import { loadAllProjects } from '@/lib/projects/load';

const projects = loadAllProjects({ includeDrafts: true });
const bySlug = new Map(projects.map((p) => [p.slug, p]));

/** Willie's own lines, exactly as he wrote them before the migration. */
const LINES: Record<string, string> = {
  cole: 'The concept learning project aims to learn domain-agnostic representations of knowledge in the form of reusable abstract concepts.',
  hackportal:
    'HackPortal is a hackathon management platform built for small and large events.',
  storygen:
    'Storygen is a tool that uses large language models and knowledge graphs to generate complex stories with characters.',
  aggie:
    'Aggie is a testbench for building intelligent agents that are modular and explainable.',
  yearbook:
    'UTD Wrapped is a yearbook for the 21st century inspired by Spotify Wrapped.',
  'comet-planning':
    'Nebula Planner is an interactive tool that lets students plan their college coursework and experiences in an intuitive drag-and-drop interface.',
  'utd-guide':
    'The UTD Survival Guide is a personalizable guide built to fit the needs of a diverse student body.',
  orbit:
    'Orbit lets introverts (and others!) find people to pull into their orbits using a fun and unique matching experience based on responses to questions, not looks.',
  website:
    'This is my personal portfolio and the hub to who I am and what I do.',
  connie:
    'A communications dashboard that connects nonprofits to older adults.',
  parlipro: 'Presiding over meetings with parlimentary procedure, done simply.',
};

test('every migrated project parses and keeps its line verbatim', () => {
  for (const [slug, line] of Object.entries(LINES)) {
    assert.equal(bySlug.get(slug)?.line, line, slug);
  }
});

test('the two write-ups keep their bodies', () => {
  assert.match(
    bySlug.get('parlipro')?.content ?? '',
    /kept having nightmares \(\/s\)/
  );
  assert.match(
    bySlug.get('connie')?.content ?? '',
    /In the United Sates, older adults/
  );
});

test('the ParliPro hero keeps the description main already carried', () => {
  const hero = bySlug.get('parlipro')?.media[0];
  assert.equal(
    hero?.kind === 'image' ? hero.alt : undefined,
    'ParliPro project graphic showing a meeting in progress'
  );
});

test('nothing migrated is published without Willie clearing the draft flag', () => {
  for (const slug of Object.keys(LINES))
    assert.equal(bySlug.get(slug)?.draft, true, slug);
});
