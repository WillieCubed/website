# ActivityPub integration (proposed)

ActivityPub would let a person on Mastodon discover `@willie@willie.page`,
follow that identity, and receive newly published posts. The site does not
implement ActivityPub delivery. This is proposed work for after launch.

The design explores how discovery, follower state, and delivery could fit around
the site's existing publishing source. Endpoint, schema, credential, and code
examples describe the proposal; they are not an available setup path or a
verified compatibility contract.

## Goal

### Discovery should lead to following and delivery

The proposed identity is `@willie@willie.page`. A Mastodon user would search for
that address, follow the resolved actor, and receive new posts without polling
the website. Discovery alone would be an incomplete result: a searchable profile
that never accepts a follow or delivers an activity does not satisfy this goal.

### Publication approval still happens on the site

Only approved public content would enter federation. The existing draft boundary
must survive this integration, and deploying federation code would not itself
authorize publishing an authored draft. Edits and deletions would also need a
specified delivery policy before this proposal could become a release contract.

## Architecture overview

An actor is the protocol identity that another server would follow. WebFinger
would resolve `@willie@willie.page` to that actor's profile. The profile would
advertise an inbox for incoming activities, an outbox for published activity
history, and a followers collection.

Following crosses those pieces: a remote server would send a Follow to the inbox,
the site would persist the relationship and send an Accept, and later delivery
would send a published post to the follower's inbox. Discovery, relationship
state, and delivery need distinct acceptance checks. A searchable actor could
still fail to accept follows or deliver anything.

The diagram retains the original Vercel Postgres storage proposal. Its
`/api/ap/` labels abbreviate the `/api/activitypub/` paths listed below. Neither
the provider label nor the diagram establishes the current hosting arrangement;
an implementation would need to reconcile storage with the approved deployment
architecture.

```
┌─────────────────────────────────────────────────────────────────┐
│                        willie.page                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  WebFinger   │    │    Actor     │    │    Inbox     │       │
│  │ /.well-known │    │  /api/ap/    │    │  /api/ap/    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Outbox     │    │  Followers   │    │   Delivery   │       │
│  │  /api/ap/    │    │  /api/ap/    │    │  (on deploy) │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘                │
│                             │                                    │
│                    ┌────────▼────────┐                          │
│                    │ Vercel Postgres │                          │
│                    │  (activitypub)  │                          │
│                    └─────────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Database schema

The original design shares a PostgreSQL database with Webmentions. Its three
tables separate actor signing identity, accepted followers, and published
activity history. That separation supports different lifetimes: rotating a key
must not erase followers, and retrying delivery must not invent a second public
activity identity.

The schema below is a starting point. It does not specify encrypted key storage,
delivery attempts, retry scheduling, or the transaction boundary between an
accepted Follow and its outgoing Accept. Those omissions remain design work;
the table definitions alone cannot establish a recoverable delivery service.

```sql
-- Actor keypairs for HTTP signatures
CREATE TABLE activitypub_keypairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Followers collection
CREATE TABLE activitypub_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_uri TEXT UNIQUE NOT NULL,
  inbox TEXT NOT NULL,
  shared_inbox TEXT,
  accepted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outbox activities (for pagination and deduplication)
CREATE TABLE activitypub_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id TEXT UNIQUE NOT NULL,
  activity_type TEXT NOT NULL,      -- Create, Update, Delete
  object_type TEXT NOT NULL,        -- Article, Note
  object_id TEXT NOT NULL,          -- URL of the content
  activity_json JSONB NOT NULL,
  published_at TIMESTAMPTZ NOT NULL
);
```

## Endpoints

### WebFinger (Discovery)

A remote client would begin with the account address and need the actor URL.
The existing WebFinger route would need to advertise the proposed ActivityPub
identity alongside its current discovery behavior.

**Route**: `app/.well-known/webfinger/route.ts`

```
GET /.well-known/webfinger?resource=acct:willie@willie.page
```

The proposed response links that account to the actor endpoint:

```json
{
  "subject": "acct:willie@willie.page",
  "links": [
    {
      "rel": "self",
      "type": "application/activity+json",
      "href": "https://willie.page/api/activitypub/actor"
    }
  ]
}
```

### Actor (Profile)

The actor profile would tell another server where to send a Follow and how to
verify requests signed by this identity. Its protocol `id` would need to remain
stable independently of the displayed name and summary.

**Route**: `app/api/activitypub/actor/route.ts`

```
GET /api/activitypub/actor
Accept: application/activity+json
```

The original proposal represents Willie as an ActivityStreams `Person`:

```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://w3id.org/security/v1"
  ],
  "id": "https://willie.page/api/activitypub/actor",
  "type": "Person",
  "preferredUsername": "willie",
  "name": "Willie Chalmers III",
  "summary": "Building software for humans.",
  "url": "https://willie.page",
  "inbox": "https://willie.page/api/activitypub/inbox",
  "outbox": "https://willie.page/api/activitypub/outbox",
  "followers": "https://willie.page/api/activitypub/followers",
  "icon": {
    "type": "Image",
    "url": "https://willie.page/assets/headshot.jpg"
  },
  "publicKey": {
    "id": "https://willie.page/api/activitypub/actor#main-key",
    "owner": "https://willie.page/api/activitypub/actor",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n..."
  }
}
```

The icon path and profile text are illustrative proposal values. They are not
proof that this actor or its assets are currently served.

### Inbox (Receive Activities)

The inbox would receive relationship changes from remote servers. Its core
lifecycle is Follow followed by Accept, and Undo Follow to remove the
relationship. Receiving likes or announces as Webmention-like responses is an
optional extension, not part of the proposed following goal.

**Route**: `app/api/activitypub/inbox/route.ts`

```
POST /api/activitypub/inbox
Content-Type: application/activity+json
```

The receiver would verify the HTTP signature before changing relationship state.
The outline below does not settle key retrieval, freshness, replay handling, or
fetch restrictions. It also leaves the persistence boundary between accepting a
Follow and delivering Accept unresolved. Those decisions determine whether an
interrupted request can be retried without a duplicate or lost relationship.

### Outbox (Activity History)

**Route**: `app/api/activitypub/outbox/route.ts`

```
GET /api/activitypub/outbox
Accept: application/activity+json
```

The proposed response is a paginated OrderedCollection of Create activities.
Stable activity IDs would let another server recognize an activity it has already
seen. Pagination and ordering need to remain consistent as new posts arrive;
returning one JSON collection in a local test would not establish that behavior.

### Followers

The followers endpoint would expose the accepted follower identities as an
OrderedCollection, an ordered list with collection metadata. It describes
relationship state; it does not establish that a
particular follower received the latest post.

**Route**: `app/api/activitypub/followers/route.ts`

```
GET /api/activitypub/followers
Accept: application/activity+json
```

### Federation Trigger

The proposed trigger would run after deployment so a remote receiver could fetch
the public original when its announcement arrives. It would compare current
content with stored activities, create activities for new posts, and deliver
them to accepted follower inboxes.

**Route**: `app/api/activitypub/federate/route.ts`

```
POST /api/activitypub/federate
Authorization: Bearer $ACTIVITYPUB_SECRET
```

The bearer secret would authorize the trigger, not verify the remote receiver's
acceptance. The current outline does not define a retry queue, per-recipient
outcomes, or what happens when deployment succeeds but only some deliveries do.
Those are necessary delivery decisions before this becomes a release procedure.

## Content mapping

The proposal distinguishes an article from a short status. This preserves a
writing's purpose for receiving clients rather than forcing every update into
one object type. The table retains the original mappings; projects and Now
updates would need an explicit source and approval policy before delivery.

| Content Type | ActivityPub Object | Notes                     |
| ------------ | ------------------ | ------------------------- |
| Writing      | Article            | Full content in `content` |
| Project      | Article            | Tagline as summary        |
| Now update   | Note               | Short-form status         |

## HTTP signatures

The proposed delivery signs server-to-server requests so a receiver can check
which actor sent them. The example below illustrates the original signing
approach; it has not been accepted as production signing code. The linked HTTP
Signatures document is a draft, and interoperability requirements must be
rechecked before choosing an implementation.

### Signing Outgoing Requests

This sketch signs the method and path, host, date, and an optional body digest.
It illustrates which request values participate in a signature; it does not
cover a complete request-building or delivery policy. For example, it uses
`pathname` without a query string, so query-bearing targets need an explicit
signing decision before reusing this code.

```typescript
import crypto from 'crypto';

function signRequest(
  privateKey: string,
  keyId: string,
  method: string,
  url: string,
  body?: string
): Headers {
  const date = new Date().toUTCString();
  const digest = body
    ? `SHA-256=${crypto.createHash('sha256').update(body).digest('base64')}`
    : undefined;

  const signedHeaders = ['(request-target)', 'host', 'date'];
  if (digest) signedHeaders.push('digest');

  const stringToSign = signedHeaders
    .map((h) => {
      if (h === '(request-target)')
        return `(request-target): ${method.toLowerCase()} ${new URL(url).pathname}`;
      if (h === 'host') return `host: ${new URL(url).host}`;
      if (h === 'date') return `date: ${date}`;
      if (h === 'digest') return `digest: ${digest}`;
    })
    .join('\n');

  const signature = crypto
    .sign('sha256', Buffer.from(stringToSign), privateKey)
    .toString('base64');

  return new Headers({
    Date: date,
    ...(digest && { Digest: digest }),
    Signature: `keyId="${keyId}",algorithm="rsa-sha256",headers="${signedHeaders.join(' ')}",signature="${signature}"`,
  });
}
```

### Verifying Incoming Requests

The proposed verification sequence would parse the Signature header, resolve the
actor's public key, reconstruct the signed request values, and verify the result
with that key.

Cryptographic verification alone would not settle whether the fetched key belongs
to the claimed actor, whether the request is fresh, or whether it has already
been processed. A receiver design would also need public-address fetch guards
and bounds around key retrieval. This outline preserves those as open questions
instead of treating four steps as a complete security contract.

## Library options

The original proposal considers a manual implementation and Fedify. Neither is
selected here. Compare them against the follow/undo lifecycle, signature checks,
retry behavior, and the site's approved runtime before choosing. A small route
surface can still create substantial maintenance work when remote servers retry,
change keys, or send malformed activities.

The package command and adapter claims below are retained proposal notes. They
are not verified current installation guidance.

### Option 1: Manual Implementation

A manual implementation would keep actor construction and protocol handling in
the repository without an adapter dependency. It would also make the site
responsible for signature interoperability, collection pagination, and recovery
from partial delivery.

That tradeoff cannot be judged by route count alone. A small set of endpoints can
still require considerable maintenance when other servers rotate keys, retry
requests, or send unexpected activities.

### Option 2: @fedify/fedify

The retained package command illustrates the dependency option considered by the
original proposal:

```bash
pnpm add @fedify/fedify @fedify/next
```

The original proposal lists signature, delivery, and collection support with a
Next.js adapter. Selection would require checking the package's current API and
runtime support against the approved hosting architecture. A library can reduce protocol code while still leaving
publication policy, persisted state, and cleanup with the site.

## Environment variables

The examples identify separate signing keys and trigger authorization. Private
keys and the trigger secret would remain server-side. The schema also proposes
persisted keypairs, so implementation must decide which store owns the signing
identity and how rotation works; configuring two independent sources could make
published actor keys disagree with outgoing signatures.

```env
# Generate with: openssl genrsa -out private.pem 2048
ACTIVITYPUB_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Generate with: openssl rsa -in private.pem -pubout -out public.pem
ACTIVITYPUB_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."

# Secret for triggering federation
ACTIVITYPUB_SECRET="random-secure-token"
```

## Files to create

Routes would translate HTTP requests and responses, while actor construction,
activity generation, signatures, storage, and delivery would live in separate
modules. This lets tests exercise delivery decisions without needing a running
route for every case. The tree describes proposed responsibilities, not a claim that every listed
path is absent: WebFinger already exists and would need an extension. A later
implementation plan would need to identify reused routes and genuinely new
modules.

```
app/
  .well-known/
    webfinger/route.ts           # Fediverse discovery
  api/activitypub/
    actor/route.ts               # Actor profile
    inbox/route.ts               # Receive Follow/Undo
    outbox/route.ts              # Activity history
    followers/route.ts           # Followers list
    federate/route.ts            # Trigger delivery

lib/activitypub/
  index.ts                       # Configuration and exports
  actor.ts                       # Actor object builder
  activities.ts                  # Create/Update/Delete builders
  signatures.ts                  # HTTP signature sign/verify
  delivery.ts                    # Send to follower inboxes
  db.ts                          # Database operations
```

## Testing

Acceptance would need to follow the remote lifecycle rather than stop at local
JSON. Discovery checks would establish that the account resolves to an actor;
a Mastodon follow would add the incoming Follow and outgoing Accept path. An
approved new post would then need an observed remote delivery, followed by Undo
Follow and cleanup of the test relationship.

The checks below are proposed and have not been run as ActivityPub acceptance.
Their production-domain URLs preserve the original examples; execution would
require a deliberately selected test identity and deployment. A local HTTP 200
would establish neither remote follow acceptance nor delivery.

### Test WebFinger

```bash
curl "https://willie.page/.well-known/webfinger?resource=acct:willie@willie.page"
```

### Test Actor

```bash
curl -H "Accept: application/activity+json" https://willie.page/api/activitypub/actor
```

### Test from Mastodon

The proposed remote check would search for `@willie@willie.page` and inspect the
resolved name, bio, and avatar. Following that profile would then need two
observations: an Accept received by Mastodon and a corresponding follower stored
by the site. A visible Follow button or searchable profile alone would not close
the lifecycle.

## References

- [ActivityPub Spec](https://www.w3.org/TR/activitypub/)
- [ActivityStreams Vocabulary](https://www.w3.org/TR/activitystreams-vocabulary/)
- [HTTP Signatures](https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures)
- [WebFinger](https://webfinger.net/)
- [How to implement a basic ActivityPub server](https://blog.joinmastodon.org/2018/06/how-to-implement-a-basic-activitypub-server/)
