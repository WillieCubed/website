const ORG_ID = 'team_RWZBBZRnQkbAXuekAC7mJN6Q';

const PROJECTS = {
  website: {
    projectName: 'website',
    projectId: 'prj_sdOlkYTaqb3M2R8YporGCi9NnRvb',
    orgId: ORG_ID,
    origin: 'https://willie.page',
    neonName: 'willie-page-indieweb-production',
    neonRegion: 'aws-us-west-2',
    blobName: 'willie-page-indieweb-production',
    branch: 'main',
  },
  'indieweb-acceptance': {
    projectName: 'indieweb-acceptance',
    projectId: 'prj_rurUFlQ4YKYKoMxGCaAyL6ASijHm',
    orgId: ORG_ID,
    origin: 'https://indieweb-acceptance.vercel.app',
    neonName: 'willie-page-indieweb-acceptance',
    neonRegion: 'aws-us-east-2',
    blobName: 'willie-indieweb-acceptance-media',
    branch: 'codex/indieweb-test-publish-20260923',
  },
};

export function parseProjectLink(json) {
  try {
    const { projectName, projectId, orgId } = JSON.parse(json);
    return { projectName, projectId, orgId };
  } catch {
    return null;
  }
}

export function targetProject(name) {
  const target = PROJECTS[name];
  if (!target) throw new Error(`Unknown Vercel project: ${name}`);
  return {
    ...target,
    matches(link) {
      return Boolean(
        link &&
        link.projectName === target.projectName &&
        link.projectId === target.projectId &&
        link.orgId === target.orgId
      );
    },
  };
}

export function linkedProject(link) {
  return (
    Object.keys(PROJECTS).find((name) => targetProject(name).matches(link)) ??
    null
  );
}
