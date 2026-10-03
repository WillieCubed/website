import { getPdsEndpoint } from '@atcute/identity';
import {
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
} from '@atcute/identity-resolver';
import type { Did } from '@atcute/lexicons';

/** Calls the global fetch at request time, so tests can stub it. */
const fetchNow: typeof fetch = (input, init) => fetch(input, init);

/**
 * DID documents, resolved by the identity library's own did:plc and
 * did:web methods. Where a repo lives is read from its DID document, never
 * written down, so a PDS move needs no change here.
 */
const resolver = new CompositeDidDocumentResolver({
  methods: {
    plc: new PlcDidDocumentResolver({ fetch: fetchNow }),
    web: new WebDidDocumentResolver({ fetch: fetchNow }),
  },
});

/** The PDS that hosts a repo. */
export async function resolvePds(did: Did): Promise<string> {
  const document = await resolver.resolve(did as Did<'plc' | 'web'>);
  const pds = getPdsEndpoint(document);
  if (!pds) throw new Error(`${did} names no PDS.`);
  return pds;
}
