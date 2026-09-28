import {
  type Mf2Properties,
  type Mf2Value,
  MicropubRequestError,
  type MicropubUpdate,
} from '@/lib/indieweb/micropub-document';

/** What a Micropub POST asks for. Anything without `action` is a create. */
export type MicropubAction =
  | { action: 'create' }
  | { action: 'update'; url: string; update: MicropubUpdate };

/**
 * Read the action from a POST without consuming its body, which a create
 * still needs. The spec defines update in JSON only; a form update in the
 * bracket syntax some clients send (`replace[content][]=…`,
 * `delete[]=category`) is read too.
 */
export async function readMicropubAction(
  request: Request
): Promise<MicropubAction> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    let body: unknown;
    try {
      body = await request.clone().json();
    } catch {
      throw new MicropubRequestError('The JSON body could not be read.');
    }
    if (!isRecord(body) || body.action === undefined) {
      return { action: 'create' };
    }
    return jsonAction(body);
  }
  if (
    type.includes('application/x-www-form-urlencoded') ||
    type.includes('multipart/form-data')
  ) {
    const form = await request.clone().formData();
    if (!form.has('action')) return { action: 'create' };
    return formAction(form);
  }
  return { action: 'create' };
}

function jsonAction(body: Record<string, unknown>): MicropubAction {
  const { action } = body;
  if (action !== 'update') throw unsupportedAction(action);
  return {
    action,
    url: requiredUrl(body.url),
    update: {
      replace: propertyMap(body.replace, 'replace'),
      add: propertyMap(body.add, 'add'),
      ...jsonDelete(body.delete),
    },
  };
}

function jsonDelete(
  value: unknown
): Pick<MicropubUpdate, 'deleteProperties' | 'deleteValues'> {
  if (value === undefined) return { deleteProperties: [], deleteValues: {} };
  if (Array.isArray(value)) {
    if (!value.every((name) => typeof name === 'string')) {
      throw new MicropubRequestError('delete lists property names as text.');
    }
    return { deleteProperties: value, deleteValues: {} };
  }
  return { deleteProperties: [], deleteValues: propertyMap(value, 'delete') };
}

function propertyMap(value: unknown, field: string): Mf2Properties {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw new MicropubRequestError(
      `${field} maps property names to arrays of values.`
    );
  }
  return Object.fromEntries(
    Object.entries(value).map(([name, values]) => {
      if (
        !Array.isArray(values) ||
        !values.every((item) => typeof item === 'string' || isRecord(item))
      ) {
        throw new MicropubRequestError(`${field}.${name} must be an array.`);
      }
      return [name, values as Mf2Value[]];
    })
  );
}

function formAction(form: FormData): MicropubAction {
  const action = form.get('action');
  if (action !== 'update') throw unsupportedAction(action);
  const url = requiredUrl(form.get('url'));
  const deleteProperties: string[] = [];
  // Maps rather than objects, so a field named after an Object.prototype
  // member such as `__proto__` stays an ordinary property name.
  const operations = {
    replace: new Map<string, Mf2Value[]>(),
    add: new Map<string, Mf2Value[]>(),
    delete: new Map<string, Mf2Value[]>(),
  };
  for (const [key, value] of form) {
    if (typeof value !== 'string') {
      throw new MicropubRequestError('An update carries no files.');
    }
    if (/^delete(\[\])?$/.test(key)) {
      deleteProperties.push(value);
      continue;
    }
    const match = /^(replace|add|delete)\[([^\]]+)\](\[\])?$/.exec(key);
    if (!match) continue;
    const values = operations[match[1] as keyof typeof operations];
    values.set(match[2], [...(values.get(match[2]) ?? []), value]);
  }
  return {
    action,
    url,
    update: {
      replace: Object.fromEntries(operations.replace),
      add: Object.fromEntries(operations.add),
      deleteProperties,
      deleteValues: Object.fromEntries(operations.delete),
    },
  };
}

function unsupportedAction(action: unknown): MicropubRequestError {
  return new MicropubRequestError(
    `The action "${String(action)}" is not supported.`
  );
}

function requiredUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new MicropubRequestError('The request needs the url of the post.');
  }
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
