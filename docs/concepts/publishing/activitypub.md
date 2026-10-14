# ActivityPub integration (proposed)

ActivityPub is proposed work for after launch. It would let people discover and
follow `@willie@willie.page` from Mastodon and receive new posts. No ActivityPub
delivery is implemented.

The design below describes the proposed architecture, endpoints, and content
mapping. Code and configuration examples are proposals, not setup instructions.

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

WebFinger resolves the address to an actor. The actor advertises its inbox,
outbox, and followers collection. The inbox handles incoming relationship changes;
a delivery process sends new activities to accepted followers. These responsibilities
need separate tests because a successful discovery request says nothing about a
remote inbox accepting a signed delivery.

The diagram retains the original Vercel Postgres design. It is a proposal-era
storage choice, not a statement about the current deployment or an instruction
to provision that service. Reconcile it with the approved hosting architecture
before implementation.

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
accepted Follow and its outgoing Accept. Resolve those omissions before treating
it as an operational schema.

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

**Route**: `app/.well-known/webfinger/route.ts`

```
GET /.well-known/webfinger?resource=acct:willie@willie.page
```

Returns:

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

**Route**: `app/api/activitypub/actor/route.ts`

```
GET /api/activitypub/actor
Accept: application/activity+json
```

Returns a Person object:

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

### Inbox (Receive Activities)

**Route**: `app/api/activitypub/inbox/route.ts`

```
POST /api/activitypub/inbox
Content-Type: application/activity+json
```

Handles:

- **Follow**: Add to followers table, send Accept
- **Undo Follow**: Remove from followers table
- **Like/Announce**: Could store as webmentions (optional)

The proposed receiver requires HTTP signature verification before changing
relationship state. The verification outline below is not a complete receiver
policy: key retrieval, request freshness, replay handling, and fetch restrictions
still need implementation decisions and acceptance checks.

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

**Route**: `app/api/activitypub/followers/route.ts`

```
GET /api/activitypub/followers
Accept: application/activity+json
```

Returns OrderedCollection of follower URIs.

### Federation Trigger

**Route**: `app/api/activitypub/federate/route.ts`

```
POST /api/activitypub/federate
Authorization: Bearer $ACTIVITYPUB_SECRET
```

The proposed trigger runs after deployment so the public post can be fetched
when another server receives its announcement. It would:

1. Compare current content with stored activities
2. Generate Create activities for new posts
3. Deliver to all follower inboxes

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

1. Parse the Signature header
2. Fetch the actor's public key from their `publicKey.id`
3. Reconstruct the signed string
4. Verify with the public key

## Library options

The original proposal considers a manual implementation and Fedify. Neither is
selected here. Compare them against the follow/undo lifecycle, signature checks,
retry behavior, and the site's approved runtime before choosing. A small route
surface can still create substantial maintenance work when remote servers retry,
change keys, or send malformed activities.

The package command and adapter claims below are retained proposal notes. They
are not verified current installation guidance.

### Option 1: Manual Implementation

A manual implementation would keep the behavior visible in the repository and
avoid depending on an adapter. It would also make the site responsible for
signature interoperability, pagination, and delivery recovery. The learning
value mentioned in the original proposal does not establish that this is the
right maintenance choice for the site.

### Option 2: @fedify/fedify

```bash
pnpm add @fedify/fedify @fedify/next
```

The original proposal lists signature, delivery, and collection support with a
Next.js adapter. Verify the package's current API and runtime support if this
option is selected. A library can reduce protocol code while still leaving
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
route for every case. These files do not exist merely because they are listed;
confirm the current tree before planning implementation.

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

These checks are proposed, and none records a completed ActivityPub test.
The curl requests inspect discovery and actor serialization; the Mastodon steps
exercise a different boundary, from a remote client through Follow and Accept.
Before release, extend that lifecycle through an approved new post, verified
remote delivery, Undo Follow, and cleanup of the test relationship. Record the
revision and remote result instead of inferring delivery from a local HTTP 200.

### Test WebFinger

```bash
curl "https://willie.page/.well-known/webfinger?resource=acct:willie@willie.page"
```

### Test Actor

```bash
curl -H "Accept: application/activity+json" https://willie.page/api/activitypub/actor
```

### Test from Mastodon

1. Search for `@willie@willie.page` in Mastodon
2. Should show profile with name, bio, avatar
3. Click Follow
4. Should receive Accept and be added to followers

## References

- [ActivityPub Spec](https://www.w3.org/TR/activitypub/)
- [ActivityStreams Vocabulary](https://www.w3.org/TR/activitystreams-vocabulary/)
- [HTTP Signatures](https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures)
- [WebFinger](https://webfinger.net/)
- [How to implement a basic ActivityPub server](https://blog.joinmastodon.org/2018/06/how-to-implement-a-basic-activitypub-server/)
