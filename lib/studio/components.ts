import { parse } from '@babel/parser';
import { randomUUID } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import { transform } from 'sucrase';

import browserRuntime from '../../.studio/browser-runtime';
import { StudioError } from './errors';
import { getStudioStore } from './store';
import type { ComponentProposal } from './types';

export function parseComponent(
  result: string,
  id: string = randomUUID()
): ComponentProposal {
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(
      result.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    );
  } catch {
    throw new StudioError(422, 'The component response must be valid JSON.');
  }
  for (const key of [
    'name',
    'description',
    'version',
    'source',
    'portableHtml',
    'portableText',
    'accessibility',
  ])
    if (typeof value[key] !== 'string' || !(value[key] as string).trim())
      throw new StudioError(422, `Component ${key} is required.`);
  if (
    !/^[A-Z][A-Za-z0-9]{1,60}$/.test(String(value.name)) ||
    !/^\d+\.\d+\.\d+$/.test(String(value.version))
  )
    throw new StudioError(422, 'Component name or version is invalid.');
  for (const key of ['properties', 'example'])
    if (
      !value[key] ||
      typeof value[key] !== 'object' ||
      Array.isArray(value[key])
    )
      throw new StudioError(422, `Component ${key} must be an object.`);
  for (const [name, property] of Object.entries(
    value.properties as Record<string, unknown>
  )) {
    if (
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(name) ||
      !property ||
      typeof property !== 'object' ||
      Array.isArray(property)
    )
      throw new StudioError(422, 'Component property schema is invalid.');
    const field = property as Record<string, unknown>;
    if (
      !['string', 'number', 'boolean'].includes(String(field.type)) ||
      typeof field.description !== 'string' ||
      (field.required !== undefined && typeof field.required !== 'boolean')
    )
      throw new StudioError(422, 'Component property schema is invalid.');
    const example = (value.example as Record<string, unknown>)[name];
    if (
      (field.required || example !== undefined) &&
      typeof example !== field.type
    )
      throw new StudioError(
        422,
        'Component example does not match its properties.'
      );
  }
  if (
    String(value.source).length > 200_000 ||
    String(value.portableHtml).length > 200_000
  )
    throw new StudioError(422, 'Component exceeds the size limit.');
  const portableHtml = sanitizeHtml(String(value.portableHtml), {
    allowedTags: sanitizeHtml.defaults.allowedTags,
    allowedAttributes: { a: ['href'], '*': ['aria-label'] },
    allowedSchemes: ['https', 'mailto'],
  });
  return {
    ...value,
    id,
    portableHtml,
    status: 'proposed',
  } as unknown as ComponentProposal;
}
export async function compileSandbox(
  proposal: ComponentProposal,
  props: Record<string, unknown> = proposal.example
): Promise<string> {
  const runtimeModules: Record<string, string> = {
    react: '__studioReact',
    'react/jsx-runtime': '__studioJSXRuntime',
    'react-dom': '__studioReactDOM',
    'react-dom/client': '__studioReactDOMClient',
  };
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(proposal.source, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
  } catch {
    throw new StudioError(422, 'Component source must be valid TSX.');
  }
  if (
    !parsed.program.body.some(
      (node) => node.type === 'ExportDefaultDeclaration'
    )
  )
    throw new StudioError(422, 'Component source needs a default export.');
  const nodes: object[] = [parsed.program];
  while (nodes.length) {
    const node = nodes.pop() as { type?: string; [key: string]: unknown };
    if (
      (node.type === 'ImportDeclaration' ||
        node.type === 'ExportNamedDeclaration' ||
        node.type === 'ExportAllDeclaration') &&
      node.source &&
      (node as { importKind?: string; exportKind?: string }).importKind !==
        'type' &&
      (node as { exportKind?: string }).exportKind !== 'type' &&
      !Object.hasOwn(runtimeModules, (node.source as { value: string }).value)
    )
      throw new StudioError(422, 'Components may only import React.');
    if (
      node.type === 'ImportExpression' ||
      (node.type === 'CallExpression' &&
        ((node.callee as { type?: string; name?: string })?.type === 'Import' ||
          ((node.callee as { type?: string; name?: string })?.type ===
            'Identifier' &&
            (node.callee as { name?: string }).name === 'require')))
    )
      throw new StudioError(422, 'Components may only import React.');
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value)
          if (child && typeof child === 'object' && 'type' in child)
            nodes.push(child);
      } else if (value && typeof value === 'object' && 'type' in value) {
        nodes.push(value);
      }
    }
  }
  let source: string;
  try {
    source = transform(proposal.source, {
      transforms: ['typescript', 'jsx', 'imports'],
      jsxRuntime: 'automatic',
      production: true,
      filePath: `${proposal.name}.tsx`,
    }).code;
  } catch {
    throw new StudioError(422, 'Component source could not be compiled.');
  }
  const moduleMap = JSON.stringify(runtimeModules);
  const bootstrap = `(()=>{const modules=${moduleMap};const exports={};const require=(name)=>{if(!Object.hasOwn(modules,name))throw Error('Components may only import React.');return globalThis[modules[name]]};((require,exports)=>{${source}\n})(require,exports);const Component=exports.default;if(!Component)throw Error('Component default export is missing.');globalThis.__studioReactDOMClient.createRoot(document.getElementById('root')).render(globalThis.__studioReact.createElement(Component,${JSON.stringify(props)}));})();`;
  const script = (browserRuntime + '\n' + bootstrap).replace(
    /<\/script/gi,
    '<\\/script'
  );
  const childPolicy = `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'`;
  const child = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${childPolicy}"><title>${proposal.name}</title></head><body><div id="root"></div><script>${script}</script></body></html>`;
  // The trusted outer document owns frame-src. Unlike a script's own CSP,
  // this policy also constrains subsequent navigation of the untrusted child.
  // Inline scripts are allowed because this frame deliberately runs generated
  // code. No nonce or external source may authorize a remote script request.
  // The outer wrapper contains no scripts. Distinct opaque origins prevent the
  // component from changing the wrapper's policy or navigating its parent.
  const outerPolicy = `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src about:; object-src 'none'`;
  const escaped = child
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${outerPolicy}"><title>${proposal.name}</title><style>html,body,iframe{margin:0;width:100%;height:100%;border:0}html,body{min-height:280px}</style></head><body><iframe title="${proposal.name}" sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${escaped}"></iframe></body></html>`;
}
export async function createProposal(
  generationId: string
): Promise<ComponentProposal> {
  const store = getStudioStore(),
    generation = await store.getGeneration(generationId);
  if (
    !generation ||
    generation.kind !== 'component' ||
    generation.status !== 'ready' ||
    !generation.result
  )
    throw new StudioError(409, 'A ready component generation is required.');
  // Stable identity prevents repeated requests from creating duplicate proposals.
  const previous = await store.proposal(generation.id);
  if (previous) return previous;
  const proposal = parseComponent(generation.result, generation.id);
  await compileSandbox(proposal);
  await store.saveProposal(proposal);
  return proposal;
}
export async function approveProposal(id: string): Promise<ComponentProposal> {
  const store = getStudioStore(),
    proposal = await store.proposal(id);
  if (!proposal) throw new StudioError(404, 'Component proposal not found.');
  await compileSandbox(proposal);
  const approved = { ...proposal, status: 'approved' as const };
  await store.saveProposal(approved);
  return approved;
}
