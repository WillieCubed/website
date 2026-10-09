import type {} from '@atcute/atproto';
import { Client, ok } from '@atcute/client';
import type { Did, Nsid } from '@atcute/lexicons';
import { PasswordSession } from '@atcute/password-session';
import { now } from '@atcute/tid';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual, parseArgs, parseEnv } from 'node:util';

let verificationFailurePath: string | undefined;
let verificationPhase = 'argument validation';
async function main() {
  const OWNER = 'did:plc:iyn6nc3ffqm2e3555exyrgvv';
  const ORIGIN = 'https://indieweb-acceptance.vercel.app';
  const { values } = parseArgs({
    options: {
      env: { type: 'string', default: '.env.standard-test.local' },
      receipt: {
        type: 'string',
        default: `.playwright-mcp/standard-site-live-${Date.now()}.json`,
      },
      write: { type: 'boolean', default: false },
      cleanup: { type: 'boolean', default: false },
      verify: { type: 'string' },
    },
  });
  if (values.verify !== undefined) {
    verificationFailurePath = `${values.receipt}.failure.json`;
    verificationPhase = 'isolated credential and origin validation';
  }

  interface Receipt {
    version: 1;
    started: string;
    did: string;
    pds: string;
    publicationUri: string;
    checks: { name: string; observedAt: string; details?: unknown }[];
    cleanup: 'pending' | 'passed' | 'failed';
    originalPublication: Record<string, unknown> | null;
    publicationVersions?: { value: Record<string, unknown>; cid?: string }[];
    owned: {
      collection:
        | 'site.standard.publication'
        | 'site.standard.document'
        | 'app.bsky.feed.post';
      rkey: string;
      versions?: { value: Record<string, unknown>; cid?: string }[];
    }[];
    error?: string;
  }

  try {
    Object.assign(process.env, parseEnv(await readFile(values.env!, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (values.write && !values.cleanup) {
    try {
      await readFile(values.receipt!, 'utf8');
      throw new Error(
        'The receipt already exists. Choose another --receipt path or resume --cleanup first.'
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  const did = process.env.NEXT_PUBLIC_ATPROTO_DID;
  assert(
    did && did !== OWNER,
    'Configure a separate acceptance DID with scripts/publishing-acceptance-setup.mts. The production owner is forbidden.'
  );
  assert.equal(
    process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, ''),
    ORIGIN,
    'Only the isolated acceptance origin is allowed.'
  );
  assert(
    process.env.ATPROTO_PUBLICATION_RKEY,
    'Acceptance publication key is missing.'
  );

  if (verificationFailurePath) verificationPhase = 'publishing module loading';
  const [
    { publishingIdentity, DOCUMENT_COLLECTION, PUBLICATION_COLLECTION },
    { resolvePds },
  ] = await Promise.all([
    import('../lib/atproto/config'),
    import('../lib/atproto/identity'),
  ]);
  const { publicationUri, publicationRkey } = publishingIdentity();
  if (verificationFailurePath)
    verificationPhase = 'public publisher DID resolution';
  const pds = await resolvePds(did as Did);
  console.log(`Step 1: Resolve the isolated account. DID ${did}; PDS ${pds}.`);

  async function publicRecord(collection: string, rkey: string) {
    const url = new URL('/xrpc/com.atproto.repo.getRecord', pds);
    url.search = new URLSearchParams({
      repo: did!,
      collection,
      rkey,
    }).toString();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    assert(
      response.ok,
      `Public PDS record request failed (${response.status}).`
    );
    return response.json() as Promise<{
      uri: string;
      cid: string;
      value: Record<string, unknown>;
    }>;
  }

  async function html(url: string) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    assert(
      response.ok,
      `Public verification request failed (${response.status}).`
    );
    return response.text();
  }

  if (values.verify) {
    verificationPhase = 'verification slug validation';
    assert(
      /^[a-z0-9-]+$/.test(values.verify),
      'Verification requires a writing slug.'
    );
    verificationPhase = 'verification module loading';
    const [{ loadWriting }, { documentRkey }, verification, { parse }] =
      await Promise.all([
        import('../lib/writings'),
        import('../lib/atproto/keys'),
        import('../lib/atproto/verification'),
        import('parse5'),
      ]);
    verificationPhase = 'published writing source loading';
    const { writing } = await loadWriting(values.verify);
    assert(!writing.draft, 'A draft cannot be verified as published.');
    const path = `/writings/${values.verify}`;
    verificationPhase = 'public publication PDS HTTP read';
    const publication = await publicRecord(
      PUBLICATION_COLLECTION,
      publicationRkey
    );
    verificationPhase = 'public publication verification endpoint HTTP read';
    const endpoint = await html(
      `${ORIGIN}/.well-known/site.standard.publication`
    );
    verificationPhase = 'public document PDS HTTP read';
    const document = await publicRecord(
      DOCUMENT_COLLECTION,
      documentRkey(path, writing.published)
    );
    verificationPhase = 'public writing page HTTP read';
    const page = await html(ORIGIN + path);
    verificationPhase = 'publication record and endpoint agreement';
    assert(
      verification.publicationIsVerified(
        publication.value,
        ORIGIN,
        publicationUri,
        endpoint
      ),
      'The publication record must be valid and match the site origin and public verification endpoint.'
    );
    verificationPhase = 'writing document head link retention';
    assert(
      verification.hasDocumentVerification(page, document.uri),
      'The writing head must retain its exact document verification link.'
    );
    verificationPhase = 'document record and writing verification agreement';
    assert(
      verification.documentIsVerified(
        document.value,
        publicationUri,
        path,
        document.uri,
        page
      ),
      'The document record must be valid and match the publication, writing path and document verification link.'
    );
    verificationPhase = 'writing publication head link retention';
    const tree = parse(page);
    const head = tree.childNodes.find((node) => node.nodeName === 'html');
    const headNode =
      head && 'childNodes' in head
        ? head.childNodes.find((node) => node.nodeName === 'head')
        : undefined;
    assert(
      headNode &&
        'childNodes' in headNode &&
        headNode.childNodes.some(
          (node) =>
            'attrs' in node &&
            node.nodeName === 'link' &&
            node.attrs.some(
              (attr) =>
                attr.name === 'rel' &&
                attr.value.split(/\s+/).includes('site.standard.publication')
            ) &&
            node.attrs.some(
              (attr) => attr.name === 'href' && attr.value === publicationUri
            )
        ),
      'The writing head must retain its publication verification link.'
    );
    console.log(
      JSON.stringify(
        {
          status: 'passed',
          checkedAt: new Date().toISOString(),
          origin: ORIGIN,
          publication: { uri: publication.uri, cid: publication.cid },
          document: { uri: document.uri, cid: document.cid },
          independentValidator:
            'pending: use the authorized browser; this script does not access or replace site-validator.fly.dev',
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  if (!values.write && !values.cleanup) {
    assert(
      process.env.ATPROTO_APP_PASSWORD,
      'The isolated account app password is missing. Run scripts/publishing-acceptance-setup.mts.'
    );
    console.log(
      'Preflight passed. No writes occurred. Run --write from the isolated acceptance branch to exercise the real PDS. Use --verify SLUG after publishing an isolated acceptance page.'
    );
    process.exit(0);
  }

  assert(
    /^codex\/publishing-compatibility-acceptance(?:-\d{8})?$/.test(
      execFileSync('git', ['branch', '--show-current'], {
        encoding: 'utf8',
      }).trim()
    ),
    'Live lifecycle writes require the isolated acceptance branch.'
  );
  assert(
    process.env.ATPROTO_APP_PASSWORD,
    'The isolated account app password is missing.'
  );
  const [
    { createRepoClient },
    { syncAtproto },
    { documentRkey },
    { localBlob },
    { mkdir },
  ] = await Promise.all([
    import('../lib/atproto/client'),
    import('../lib/atproto/sync'),
    import('../lib/atproto/keys'),
    import('../lib/atproto/blobs'),
    import('node:fs/promises'),
  ]);
  const { dirname } = await import('node:path');
  const rawClient = await createRepoClient(process.env.ATPROTO_APP_PASSWORD);
  const get = rawClient.getRecord!;
  let receipt: Receipt;
  let extraSession: PasswordSession | undefined;
  async function rpc() {
    extraSession ??= await PasswordSession.login({
      service: pds,
      identifier: did!,
      password: process.env.ATPROTO_APP_PASSWORD!,
    });
    assert(
      extraSession.did === did,
      'The acceptance session belongs to another account.'
    );
    return new Client({ handler: extraSession });
  }
  async function intent(
    collection: string,
    rkey: string,
    value?: Record<string, unknown>
  ) {
    const owned = receipt.owned.find(
      (record) => record.collection === collection && record.rkey === rkey
    );
    const versions = owned
      ? (owned.versions ??= [])
      : collection === PUBLICATION_COLLECTION && rkey === publicationRkey
        ? (receipt.publicationVersions ??= [])
        : undefined;
    assert(
      versions,
      'The synchronization attempted to mutate an unreserved record.'
    );
    const current = await get(collection, rkey);
    assert(
      !current ||
        versions.some(
          (version) =>
            isDeepStrictEqual(version.value, current.value) &&
            (!version.cid || version.cid === current.cid)
        ),
      'The reserved record changed outside this acceptance run.'
    );
    if (
      value &&
      !versions.some((version) => isDeepStrictEqual(version.value, value))
    )
      versions.push({ value });
    await save();
  }
  async function observed(collection: string, rkey: string) {
    const owned = receipt.owned.find(
      (record) => record.collection === collection && record.rkey === rkey
    );
    const versions = owned?.versions ?? receipt.publicationVersions!;
    const record = await get(collection, rkey);
    if (record) {
      const version = versions.find((version) =>
        isDeepStrictEqual(version.value, record.value)
      );
      assert(
        version,
        'The PDS returned a record outside the journaled write intent.'
      );
      version.cid = record.cid;
      await save();
    }
  }
  const client: import('../lib/atproto/types').RepoClient = {
    ...rawClient,
    async applyWrites(writes) {
      for (const write of writes)
        await intent(
          write.collection,
          write.rkey,
          'value' in write ? write.value : undefined
        );
      await rawClient.applyWrites(writes);
      for (const write of writes) await observed(write.collection, write.rkey);
    },
    async putRecord(collection, rkey, value, cid) {
      await intent(collection, rkey, value);
      await rawClient.putRecord!(collection, rkey, value, cid);
      await observed(collection, rkey);
    },
    async createRecord(collection, rkey, value) {
      await intent(collection, rkey, value);
      const result = await rawClient.createRecord!(collection, rkey, value);
      await observed(collection, rkey);
      return result;
    },
  };
  let uploads = 0;
  const upload = client.uploadBlob;
  client.uploadBlob = async (blob) => {
    uploads++;
    await upload(blob);
  };
  async function save() {
    await mkdir(dirname(values.receipt!), { recursive: true });
    await writeFile(values.receipt!, JSON.stringify(receipt, null, 2) + '\n', {
      mode: 0o600,
    });
    await chmod(values.receipt!, 0o600);
  }
  async function checked(name: string, details?: unknown) {
    receipt.checks.push({
      name,
      observedAt: new Date().toISOString(),
      details,
    });
    await save();
    console.log(`Passed: ${name}.`);
  }
  async function cleanup() {
    // The journal lists only keys reserved by this run. Never delete every
    // record in a collection or remove a pre-existing publication.
    for (const record of [...receipt.owned].reverse()) {
      const current = await get(record.collection, record.rkey);
      if (current) {
        assert(
          record.versions?.some(
            (version) =>
              isDeepStrictEqual(version.value, current.value) &&
              (!version.cid || version.cid === current.cid)
          ),
          'Refuse cleanup of a changed or unjournaled record.'
        );
        await ok(
          (await rpc()).post('com.atproto.repo.deleteRecord', {
            input: {
              repo: did as Did,
              collection: record.collection as Nsid,
              rkey: record.rkey,
              swapRecord: current.cid,
            },
          })
        );
      }
    }
    const current = await get(PUBLICATION_COLLECTION, publicationRkey);
    if (receipt.originalPublication && current) {
      assert(
        receipt.publicationVersions?.some(
          (version) =>
            isDeepStrictEqual(version.value, current.value) &&
            (!version.cid || version.cid === current.cid)
        ),
        'Refuse restoration over a changed publication.'
      );
      await rawClient.putRecord!(
        PUBLICATION_COLLECTION,
        publicationRkey,
        receipt.originalPublication,
        current.cid
      );
    }
    for (const record of receipt.owned)
      assert.equal(
        await get(record.collection, record.rkey),
        null,
        'Acceptance record cleanup failed.'
      );
    if (receipt.originalPublication)
      assert.deepEqual(
        (await get(PUBLICATION_COLLECTION, publicationRkey))?.value,
        receipt.originalPublication
      );
    receipt.cleanup = 'passed';
    await save();
  }

  try {
    if (values.cleanup) {
      receipt = JSON.parse(await readFile(values.receipt!, 'utf8')) as Receipt;
      assert.equal(receipt.version, 1);
      assert.equal(receipt.did, did);
      assert.equal(receipt.publicationUri, publicationUri);
      assert(
        receipt.owned.every(
          (record) =>
            [
              PUBLICATION_COLLECTION,
              DOCUMENT_COLLECTION,
              'app.bsky.feed.post',
            ].includes(record.collection) &&
            /^[234567a-z]{13}$/.test(record.rkey)
        ),
        'Invalid cleanup journal.'
      );
      await cleanup();
      console.log(
        'Cleanup passed. The original publication is restored and every reserved record is absent.'
      );
    } else {
      console.log(
        'Step 2: Refuse existing documents before running a destructive synchronization test.'
      );
      const existing = await client.listRecords(DOCUMENT_COLLECTION);
      assert(
        !existing.some((record) => record.value.site === publicationUri),
        'Acceptance publication already contains documents. Use a separate empty acceptance publication.'
      );
      const prior = await get(PUBLICATION_COLLECTION, publicationRkey);
      if (prior)
        assert.equal(
          prior.value.url,
          ORIGIN,
          'Existing publication belongs to another origin.'
        );
      const started = new Date();
      const slug = `standard-acceptance-${started.getTime()}`;
      const path = `/writings/${slug}`;
      const rkey = documentRkey(path, started);
      assert.equal(
        await get(DOCUMENT_COLLECTION, rkey),
        null,
        'The generated document key already belongs to a record.'
      );
      const foreignPublicationKey = now();
      const foreignDocumentKey = now();
      assert.equal(
        await get(PUBLICATION_COLLECTION, foreignPublicationKey),
        null
      );
      assert.equal(await get(DOCUMENT_COLLECTION, foreignDocumentKey), null);
      receipt = {
        version: 1,
        started: started.toISOString(),
        did,
        pds,
        publicationUri,
        checks: [],
        cleanup: 'pending',
        originalPublication: prior?.value ?? null,
        publicationVersions: prior
          ? [{ value: prior.value, cid: prior.cid }]
          : [],
        owned: [
          { collection: PUBLICATION_COLLECTION, rkey: foreignPublicationKey },
          { collection: DOCUMENT_COLLECTION, rkey: foreignDocumentKey },
          { collection: DOCUMENT_COLLECTION, rkey },
        ],
      };
      if (!prior)
        receipt.owned.unshift({
          collection: PUBLICATION_COLLECTION,
          rkey: publicationRkey,
        });
      await save();
      let failure: unknown;
      const originalSettings = process.env.ATPROTO_PUBLICATION_SETTINGS;
      try {
        const foreignUri = `at://${did}/${PUBLICATION_COLLECTION}/${foreignPublicationKey}`;
        await client.applyWrites([
          {
            $type: 'com.atproto.repo.applyWrites#create',
            collection: PUBLICATION_COLLECTION,
            rkey: foreignPublicationKey,
            value: {
              $type: PUBLICATION_COLLECTION,
              url: 'https://example.com',
              name: 'Disposable foreign-publication preservation check',
            },
          },
          {
            $type: 'com.atproto.repo.applyWrites#create',
            collection: DOCUMENT_COLLECTION,
            rkey: foreignDocumentKey,
            value: {
              $type: DOCUMENT_COLLECTION,
              site: foreignUri,
              title: 'Disposable foreign document',
              publishedAt: started.toISOString(),
            },
          },
        ]);
        const foreignBefore = [
          await get(PUBLICATION_COLLECTION, foreignPublicationKey),
          await get(DOCUMENT_COLLECTION, foreignDocumentKey),
        ];
        const icon = await localBlob(
          await readFile('public/brand/social/avatar-400.png'),
          'image/png'
        );
        const fetchImage = async (url: string) =>
          url.endsWith('/brand/social/avatar-400.png') ? icon : null;
        console.log(
          'Step 3: Run the actual content loader and prove authored drafts stay absent.'
        );
        const { getWritingSlugs, loadWriting } =
          await import('../lib/writings');
        const writings = await Promise.all(
          (await getWritingSlugs()).map(loadWriting)
        );
        assert(
          writings.every(({ writing }) => writing.draft),
          'Lifecycle fixture requires a checkout containing only authored drafts.'
        );
        const drafts = await syncAtproto({ client, fetchImage });
        assert.equal(drafts.status, 'synced');
        assert(
          !(await client.listRecords(DOCUMENT_COLLECTION)).some(
            (record) => record.value.site === publicationUri
          )
        );
        await checked('Actual loader excludes every authored draft', {
          drafts: writings.length,
        });
        process.env.ATPROTO_PUBLICATION_SETTINGS = JSON.stringify({
          labels: {
            $type: 'com.atproto.label.defs#selfLabels',
            values: [{ val: 'test-label' }],
          },
          preferences: { showInDiscover: false },
        });
        const source = {
          slug,
          title: 'Disposable Standard.site lifecycle check',
          description:
            'This record exists only on the isolated account during acceptance.',
          published: started,
          lastUpdated: started,
          tags: ['acceptance'],
          image: '/brand/social/avatar-400.png',
          photos: [
            {
              url: ORIGIN + '/brand/social/avatar-400.png',
              alt: 'Authored photo description',
            },
          ],
          micropub: {
            type: ['h-entry'],
            properties: {
              audio: [
                {
                  value: 'https://example.com/audio.mp3',
                  alt: 'Authored audio description',
                },
              ],
              video: [
                {
                  value: 'https://example.com/video.mp4',
                  alt: 'Authored video description',
                },
              ],
              attachment: [
                {
                  value: 'https://example.com/document.pdf',
                  alt: 'Authored file description',
                },
              ],
            },
          },
          body: 'Prose with `inline code`.\n\n```ts\nconst answer = 42;\n```\n\n> Quoted words.\n\n- List item\n\n| Column | Value |\n| --- | --- |\n| Row | Cell |\n\n![An image description](https://example.com/image.png)',
          atproto: undefined as
            | import('../lib/atproto/metadata').DocumentMetadata
            | undefined,
        };
        const extensions = {
          contributors: [
            {
              $type: 'site.standard.document#contributor' as const,
              did: did as Did,
              displayName: 'Acceptance author',
              role: 'author',
            },
          ],
          labels: {
            $type: 'com.atproto.label.defs#selfLabels' as const,
            values: [{ val: 'test-label' }],
          },
          content: {
            $type: 'dev.williecubed.acceptance.content',
            text: 'Typed content payload',
            nested: { retained: true },
          },
          links: {
            $type: 'dev.williecubed.acceptance.links',
            entries: [
              {
                href: 'https://example.com/reference',
                title: 'Typed reference',
              },
            ],
          },
        };
        const { parseDocumentMetadata } =
          await import('../lib/atproto/metadata');
        const postKey = now();
        assert.equal(await get('app.bsky.feed.post', postKey), null);
        receipt.owned.push({ collection: 'app.bsky.feed.post', rkey: postKey });
        await save();
        const associated = await client.createRecord!(
          'app.bsky.feed.post',
          postKey,
          {
            $type: 'app.bsky.feed.post',
            text: 'Disposable explicit Standard.site association.',
            createdAt: started.toISOString(),
            embed: {
              $type: 'app.bsky.embed.external',
              external: {
                uri: ORIGIN + path,
                title: source.title,
                description: source.description,
              },
            },
          }
        );
        const postRef = {
          uri: associated.uri as import('@atcute/atproto').ComAtprotoRepoStrongRef.Main['uri'],
          cid: associated.cid as import('@atcute/atproto').ComAtprotoRepoStrongRef.Main['cid'],
        };
        const completeExtensions = { ...extensions, bskyPostRef: postRef };
        source.atproto = parseDocumentMetadata(completeExtensions);
        console.log(
          'Step 4: Create, read, update, omit and explicitly remove extension fields on the real PDS.'
        );
        const created = await syncAtproto({
          client,
          writings: [source],
          fetchImage,
        });
        assert(created.status === 'synced' && created.created === 1);
        const document = await publicRecord(DOCUMENT_COLLECTION, rkey);
        for (const [field, value] of Object.entries(completeExtensions))
          assert.deepEqual(document.value[field], value);
        for (const [field, value] of Object.entries({
          $type: DOCUMENT_COLLECTION,
          site: publicationUri,
          path,
          title: source.title,
          description: source.description,
          publishedAt: started.toISOString(),
          tags: source.tags,
          coverImage: icon.ref,
        }))
          assert.deepEqual(document.value[field], value);
        assert(!Object.hasOwn(document.value, 'updatedAt'));
        for (const text of [
          'inline code',
          'const answer = 42;',
          'Quoted words.',
          'List item',
          'Column',
          'Cell',
          'An image description',
          'Authored photo description',
          'Authored audio description',
          'Authored video description',
          'Authored file description',
        ])
          assert(
            String(document.value.textContent).includes(text),
            `Readable text lost ${text}.`
          );
        const publication = await publicRecord(
          PUBLICATION_COLLECTION,
          publicationRkey
        );
        assert.deepEqual(publication.value.preferences, {
          showInDiscover: false,
        });
        assert.deepEqual(publication.value.labels, extensions.labels);
        const [{ site }, { themeSchemes }] = await Promise.all([
          import('../lib/site'),
          import('../lib/theme'),
        ]);
        const rgb = (hex: string) => ({
          $type: 'site.standard.theme.color#rgb',
          r: parseInt(hex.slice(1, 3), 16),
          g: parseInt(hex.slice(3, 5), 16),
          b: parseInt(hex.slice(5, 7), 16),
        });
        const colors = themeSchemes.light;
        const expectedTheme = {
          $type: 'site.standard.theme.basic',
          background: rgb(colors.surface),
          foreground: rgb(colors.onSurface),
          accent: rgb(colors.primary),
          accentForeground: rgb(colors.onPrimary),
        };
        for (const [field, value] of Object.entries({
          $type: PUBLICATION_COLLECTION,
          name: site.name,
          url: ORIGIN,
          description: site.description,
          icon: icon.ref,
          basicTheme: expectedTheme,
        }))
          assert.deepEqual(publication.value[field], value);
        await checked(
          'Create and complete readable text with typed extension round trip',
          {
            uri: document.uri,
            cid: document.cid,
            publicationCid: publication.cid,
          }
        );
        const repeated = await syncAtproto({
          client,
          writings: [source],
          fetchImage,
        });
        assert(repeated.status === 'synced' && repeated.writes.length === 0);
        assert.equal((await get(DOCUMENT_COLLECTION, rkey))?.cid, document.cid);
        await checked('Repeated sync changes no records');
        const changed = {
          ...source,
          title: 'Edited disposable Standard.site check',
          lastUpdated: new Date(started.getTime() + 1000),
          atproto: parseDocumentMetadata({
            ...completeExtensions,
            content: { ...extensions.content, text: 'Edited typed payload' },
          }),
        };
        await syncAtproto({ client, writings: [changed], fetchImage });
        const edited = await publicRecord(DOCUMENT_COLLECTION, rkey);
        assert.equal(edited.value.title, changed.title);
        assert.equal(edited.value.updatedAt, changed.lastUpdated.toISOString());
        assert.deepEqual(edited.value.content, changed.atproto?.content);
        await checked(
          'Update preserves the document key and updates author content',
          { uri: edited.uri, cid: edited.cid }
        );
        const members = [
          {
            $type: 'app.bsky.feed.post',
            text: 'Known typed post content',
            createdAt: started.toISOString(),
          },
          {
            $type: 'site.standard.document',
            site: ORIGIN,
            title: 'Known typed document',
            publishedAt: started.toISOString(),
          },
          {
            $type: 'site.standard.publication',
            url: ORIGIN,
            name: 'Known typed publication',
          },
          expectedTheme,
          rgb('#123456'),
          {
            $type: 'site.standard.theme.color#rgba',
            r: 18,
            g: 52,
            b: 86,
            a: 50,
          },
          extensions.labels,
        ];
        for (const member of members) {
          const typed = {
            ...changed,
            atproto: parseDocumentMetadata({
              ...completeExtensions,
              content: member,
              links: member,
            }),
          };
          await syncAtproto({ client, writings: [typed], fetchImage });
          const actual = await publicRecord(DOCUMENT_COLLECTION, rkey);
          assert.deepEqual(actual.value.content, member);
          assert.deepEqual(actual.value.links, member);
        }
        await checked(
          'Every supported known union member round trips through both typed fields',
          { types: members.map((member) => member.$type) }
        );
        await syncAtproto({ client, writings: [changed], fetchImage });
        const stable = await publicRecord(DOCUMENT_COLLECTION, rkey);
        process.env.ATPROTO_PUBLICATION_SETTINGS = JSON.stringify({
          labels: extensions.labels,
          preferences: { showInDiscover: true },
        });
        await syncAtproto({ client, writings: [changed], fetchImage });
        assert.deepEqual(
          (await publicRecord(PUBLICATION_COLLECTION, publicationRkey)).value
            .preferences,
          { showInDiscover: true }
        );
        process.env.ATPROTO_PUBLICATION_SETTINGS = JSON.stringify({
          labels: extensions.labels,
          preferences: { showInDiscover: false },
        });
        await syncAtproto({ client, writings: [changed], fetchImage });
        await checked(
          'Publication discovery preference accepts both configured values'
        );
        const publicationStable = await publicRecord(
          PUBLICATION_COLLECTION,
          publicationRkey
        );
        const uploadedBefore = uploads;
        const invalidMime = await localBlob(
          new TextEncoder().encode('Not an image'),
          'text/html'
        );
        const oversized = await localBlob(
          new Uint8Array(1_000_001),
          'image/png'
        );
        for (const [name, blob] of [
          ['MIME', invalidMime],
          ['size', oversized],
        ] as const) {
          for (const target of ['icon', 'cover']) {
            let imageRequests = 0;
            await assert.rejects(
              syncAtproto({
                client,
                writings: [changed],
                fetchImage: async () =>
                  (++imageRequests === 1) === (target === 'icon') ? blob : icon,
              })
            );
            assert.equal(
              (await publicRecord(PUBLICATION_COLLECTION, publicationRkey)).cid,
              publicationStable.cid
            );
            assert.equal(
              (await publicRecord(DOCUMENT_COLLECTION, rkey)).cid,
              stable.cid
            );
            assert.equal(
              uploads,
              uploadedBefore,
              `${name} rejection must precede blob upload.`
            );
          }
        }
        await assert.rejects(
          syncAtproto({
            client,
            writings: [
              {
                ...changed,
                atproto: parseDocumentMetadata({
                  ...completeExtensions,
                  content: {
                    $type: 'dev.williecubed.acceptance.content',
                    payload: 'x'.repeat(900_001),
                  },
                }),
              },
            ],
            fetchImage,
          }),
          /safe record size/
        );
        await assert.rejects(
          syncAtproto({
            client,
            writings: [{ ...changed, published: new Date(Number.NaN) }],
            fetchImage,
          })
        );
        assert.equal(
          (await publicRecord(DOCUMENT_COLLECTION, rkey)).cid,
          stable.cid
        );
        assert.equal(
          (await publicRecord(PUBLICATION_COLLECTION, publicationRkey)).cid,
          publicationStable.cid
        );
        assert.equal(uploads, uploadedBefore);
        await checked(
          'Oversize blobs, unsupported MIME, record size and invalid dates fail before any PDS mutation',
          {
            scope: 'Publishing validation with real unchanged PDS CIDs',
            blobMaxBytes: 1_000_000,
            recordSafeMaxBytes: 900_000,
          }
        );
        const { fetchImageBlob } = await import('../lib/atproto/blobs');
        const validRemote = await fetchImageBlob(
          ORIGIN + '/brand/social/avatar-400.png',
          { icon: true }
        );
        assert.deepEqual(validRemote?.ref, icon.ref);
        const smallResponse = await fetch(ORIGIN + '/brand/web/icon-96.png', {
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        assert(
          smallResponse.ok &&
            smallResponse.headers.get('content-type')?.startsWith('image/png')
        );
        const { imageSize } = await import('image-size');
        assert.deepEqual(
          imageSize(new Uint8Array(await smallResponse.arrayBuffer())).width,
          96
        );
        assert.equal(
          await fetchImageBlob(ORIGIN + '/brand/web/icon-96.png', {
            icon: true,
          }),
          null
        );
        const svgResponse = await fetch(ORIGIN + '/icon.svg', {
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        assert(svgResponse.ok);
        assert.equal(
          await fetchImageBlob(ORIGIN + '/icon.svg', { icon: true }),
          null
        );
        await checked(
          'Actual hosted image fetch accepts the valid icon and rejects undersized and unsupported icons',
          {
            validSize: 400,
            rejectedSize: 96,
            minimumIconSize: 256,
            scope: 'Actual public acceptance HTTP image responses',
          }
        );
        const clipped = {
          ...changed,
          title: 't'.repeat(501),
          description: 'd'.repeat(3001),
          tags: ['#acceptance', 'g'.repeat(129)],
        };
        await syncAtproto({ client, writings: [clipped], fetchImage });
        const bounded = await publicRecord(DOCUMENT_COLLECTION, rkey);
        assert.equal(String(bounded.value.title).length, 500);
        assert.equal(String(bounded.value.description).length, 3000);
        assert.deepEqual(bounded.value.tags, [
          'acceptance',
          'g'.repeat(127) + '…',
        ]);
        await checked(
          'Title, description and tag schema boundaries produce valid real records',
          {
            uri: bounded.uri,
            cid: bounded.cid,
            titleGraphemes: 500,
            descriptionGraphemes: 3000,
            tagGraphemes: 128,
          }
        );
        await syncAtproto({ client, writings: [changed], fetchImage });
        const invalidAuthoring = [
          {
            content: {
              $type: 'app.bsky.feed.post',
              text: 'Missing required timestamp',
            },
          },
          {
            links: {
              $type: 'site.standard.theme.color#rgb',
              r: 256,
              g: 0,
              b: 0,
            },
          },
          { content: { $type: 'invalid' } },
          { contributors: [{ did: 'invalid-did' }] },
          { contributors: [{ did, displayName: 'a'.repeat(101) }] },
          { contributors: [{ did, role: 'a'.repeat(101) }] },
          {
            labels: {
              $type: 'com.atproto.label.defs#selfLabels',
              values: Array.from({ length: 11 }, () => ({ val: 'test-label' })),
            },
          },
        ];
        for (const metadata of invalidAuthoring)
          assert.throws(() => parseDocumentMetadata(metadata));
        assert.equal(
          (await publicRecord(DOCUMENT_COLLECTION, rkey)).cid,
          stable.cid
        );
        await checked(
          'Malformed known unions, contributors and label limits fail authoring without changing PDS records',
          {
            scope: 'Authoring validation with independent PDS unchanged read',
            cases: invalidAuthoring.length,
          }
        );
        const external: Record<string, unknown> = {
          ...edited.value,
          content: {
            $type: 'dev.williecubed.acceptance.content',
            text: 'Extension supplied by another client',
          },
          externalField: { retained: true },
        };
        await client.putRecord!(
          DOCUMENT_COLLECTION,
          rkey,
          external,
          edited.cid
        );
        delete process.env.ATPROTO_PUBLICATION_SETTINGS;
        await syncAtproto({
          client,
          writings: [{ ...changed, atproto: undefined }],
          fetchImage: async () => null,
        });
        const retained = await publicRecord(DOCUMENT_COLLECTION, rkey);
        for (const field of [
          'content',
          'links',
          'contributors',
          'labels',
          'bskyPostRef',
          'coverImage',
          'externalField',
        ])
          assert.deepEqual(retained.value[field], external[field]);
        const retainedPublication = await publicRecord(
          PUBLICATION_COLLECTION,
          publicationRkey
        );
        for (const field of ['preferences', 'labels', 'icon'])
          assert.deepEqual(
            retainedPublication.value[field],
            publication.value[field]
          );
        await checked(
          'Omission and failed image fetch retain externally supplied fields'
        );
        process.env.ATPROTO_PUBLICATION_SETTINGS = JSON.stringify({
          labels: null,
          preferences: { showInDiscover: false },
        });
        await syncAtproto({
          client,
          writings: [
            {
              ...changed,
              atproto: {
                content: null,
                links: null,
                contributors: null,
                labels: null,
                bskyPostRef: null,
              },
            },
          ],
          fetchImage,
        });
        const removed = await publicRecord(DOCUMENT_COLLECTION, rkey);
        for (const field of [
          'content',
          'links',
          'contributors',
          'labels',
          'bskyPostRef',
        ])
          assert(!Object.hasOwn(removed.value, field));
        assert.deepEqual(removed.value.externalField, { retained: true });
        const withoutLabels = await publicRecord(
          PUBLICATION_COLLECTION,
          publicationRkey
        );
        assert(!Object.hasOwn(withoutLabels.value, 'labels'));
        assert.deepEqual(withoutLabels.value.icon, icon.ref);
        assert.deepEqual(withoutLabels.value.basicTheme, expectedTheme);
        await checked('Explicit null removes only selected extension fields');
        console.log(
          'Step 5: Unpublish the fixture and verify foreign records remain unchanged.'
        );
        await syncAtproto({ client, writings: [], fetchImage });
        assert.equal(await get(DOCUMENT_COLLECTION, rkey), null);
        assert.deepEqual(
          [
            await get(PUBLICATION_COLLECTION, foreignPublicationKey),
            await get(DOCUMENT_COLLECTION, foreignDocumentKey),
          ],
          foreignBefore
        );
        await checked('Deletion and foreign publication/document preservation');
        process.env.ATPROTO_PUBLICATION_SETTINGS = JSON.stringify({
          labels: extensions.labels,
          preferences: { showInDiscover: false },
        });
        const restoredSync = await syncAtproto({
          client,
          writings: [changed],
          fetchImage,
        });
        assert(restoredSync.status === 'synced' && restoredSync.created === 1);
        const restored = await publicRecord(DOCUMENT_COLLECTION, rkey);
        assert.equal(restored.uri, stable.uri);
        assert.equal(restored.cid, stable.cid);
        assert.deepEqual(restored.value, stable.value);
        const restoredRepeated = await syncAtproto({
          client,
          writings: [changed],
          fetchImage,
        });
        assert(
          restoredRepeated.status === 'synced' &&
            !restoredRepeated.writes.length
        );
        assert.deepEqual(
          [
            await get(PUBLICATION_COLLECTION, foreignPublicationKey),
            await get(DOCUMENT_COLLECTION, foreignDocumentKey),
          ],
          foreignBefore
        );
        await checked(
          'Unpublished writing restores the original permalink, key and complete author record',
          { uri: restored.uri, cid: restored.cid, unchangedRepeatedWrites: 0 }
        );
        await syncAtproto({ client, writings: [], fetchImage });
        assert.equal(await get(DOCUMENT_COLLECTION, rkey), null);
      } catch (error) {
        failure = error;
        receipt.error = error instanceof Error ? error.message : String(error);
      } finally {
        if (originalSettings === undefined)
          delete process.env.ATPROTO_PUBLICATION_SETTINGS;
        else process.env.ATPROTO_PUBLICATION_SETTINGS = originalSettings;
      }
      console.log(
        'Step 6: Remove reserved test records and restore the original publication.'
      );
      try {
        await cleanup();
      } catch (error) {
        receipt.cleanup = 'failed';
        receipt.error = `${receipt.error ?? ''} Cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
        await save();
        throw new Error(
          `Cleanup failed. Retry with --cleanup --receipt ${values.receipt}.`,
          { cause: error }
        );
      }
      if (failure) throw failure;
      console.log(
        `Real PDS lifecycle passed. Receipt: ${values.receipt}. Public deployed-page verification and the independent browser validator remain separate gates.`
      );
    }
  } finally {
    try {
      await client.close();
    } finally {
      if (extraSession) await extraSession.logout();
    }
  }
}
await main().catch(async (error: unknown) => {
  if (verificationFailurePath) {
    try {
      const { mkdir } = await import('node:fs/promises');
      const { dirname } = await import('node:path');
      const parent = dirname(verificationFailurePath);
      await mkdir(parent, { recursive: true, mode: 0o700 });
      await chmod(parent, 0o700);
      await writeFile(
        verificationFailurePath,
        JSON.stringify(
          {
            phase: verificationPhase,
            observedAt: new Date().toISOString(),
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : { name: 'UnknownError' },
          },
          null,
          2
        ) + '\n',
        { mode: 0o600 }
      );
      await chmod(verificationFailurePath, 0o600);
    } catch {
      // A diagnostic filesystem failure must not expose or replace the verification error.
    }
  }
  console.error(
    'Real acceptance verification failed. Check the private receipt and run its exact cleanup command before retrying. Credentials and provider request details are withheld.'
  );
  process.exitCode = 1;
});
