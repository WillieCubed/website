import { compileSandbox, parseComponent } from './components';
import { StudioError } from './errors';

const portableFields = [
  'portableHtml',
  'portableText',
  'accessibility',
] as const;

function jsonObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(
      text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    );
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Ask the same personal runtime for only the static fields it omitted. */
export async function validateWidgetPackage(
  output: string,
  generationId: string,
  repair: (packageText: string, missing: string[]) => Promise<string>
): Promise<string> {
  try {
    await compileSandbox(parseComponent(output, generationId));
    return output;
  } catch (error) {
    if (!(error instanceof StudioError) || error.status !== 422) throw error;
    const original = jsonObject(output);
    if (!original || typeof original.source !== 'string') throw error;
    const missing = portableFields.filter(
      (field) =>
        typeof original[field] !== 'string' ||
        !(original[field] as string).trim()
    );
    if (missing.length === 0) throw error;

    const completion = jsonObject(await repair(output, missing));
    if (!completion)
      throw new StudioError(422, 'Portable representation must be valid JSON.');
    const repaired = { ...original };
    for (const field of missing) repaired[field] = completion[field];
    const result = JSON.stringify(repaired);
    await compileSandbox(parseComponent(result, generationId));
    return result;
  }
}
