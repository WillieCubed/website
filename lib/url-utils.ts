if (process.env.NEXT_PUBLIC_BASE_URL === undefined) {
  throw new Error('NEXT_PUBLIC_BASE_URL environment variable is not set');
}

/**
 * A tagged template literal utilty function to generate URLs using the site's base URL.
 *
 * Note that this requires the `NEXT_PUBLIC_BASE_URL` environment variable to be set.
 *
 * @example url`/projects/${project.codename}`
 */
export function siteRoute(strings: TemplateStringsArray, ...values: string[]) {
  let result = '';
  strings.forEach((string, i) => {
    result += string;
    if (values[i]) {
      result += values[i];
    }
  });
  const fullPath = `${process.env.NEXT_PUBLIC_BASE_URL}${result}`;
  return fullPath;
}
