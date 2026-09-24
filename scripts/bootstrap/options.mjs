export const PHASES = ['tools', 'workspace', 'env', 'auth', 'deployment'];

export function parseArguments(args) {
  const options = {
    doctor: false,
    localOnly: false,
    phase: null,
    project: null,
    help: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--doctor') options.doctor = true;
    else if (arg === '--local-only') options.localOnly = true;
    else if (arg === '--help') options.help = true;
    else if (arg === '--phase' || arg === '--project') {
      const value = args[++index];
      if (!value || value.startsWith('--'))
        throw new Error(`${arg} needs a value`);
      if (arg === '--phase') options.phase = value;
      else options.project = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.phase && !PHASES.includes(options.phase))
    throw new Error(`Unknown phase: ${options.phase}`);
  if (
    options.project &&
    !['website', 'indieweb-acceptance'].includes(options.project)
  ) {
    throw new Error(`Unknown project: ${options.project}`);
  }
  if (
    options.localOnly &&
    options.phase &&
    ['auth', 'deployment'].includes(options.phase)
  ) {
    throw new Error(`--phase ${options.phase} cannot run with --local-only`);
  }
  if (options.localOnly && options.project)
    throw new Error('--project cannot run with --local-only');
  return options;
}

export function selectedPhases(options) {
  return PHASES.filter(
    (phase) =>
      (!options.phase || options.phase === phase) &&
      (!options.localOnly || !['auth', 'deployment'].includes(phase))
  );
}
