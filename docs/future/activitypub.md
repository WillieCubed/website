# ActivityPub Integration (Planned)

This document outlines the planned ActivityPub implementation for federating the
site with Mastodon and other fediverse platforms.

## Goal

Enable `@willie@willie.page` to be discoverable and followable from Mastodon,
with new posts automatically delivered to followers.

## Architecture Overview

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

## Database Schema

Uses the same Vercel Postgres database as webmentions.

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

Requires HTTP signature verification.

### Outbox (Activity History)

**Route**: `app/api/activitypub/outbox/route.ts`

```
GET /api/activitypub/outbox
Accept: application/activity+json
```

Returns paginated OrderedCollection of Create activities.

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

Called after deploy to:

1. Compare current content with stored activities
2. Generate Create activities for new posts
3. Deliver to all follower inboxes

## Content Mapping

| Content Type | ActivityPub Object | Notes                     |
| ------------ | ------------------ | ------------------------- |
| Writing      | Article            | Full content in `content` |
| Project      | Article            | Tagline as summary        |
| Now update   | Note               | Short-form status         |

## HTTP Signatures

ActivityPub requires signed requests for server-to-server communication.

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

## Library Options

### Option 1: Manual Implementation

- Full control, minimal dependencies
- More code to write and maintain
- Good for learning

### Option 2: @fedify/fedify

```bash
pnpm add @fedify/fedify @fedify/next
```

- Handles signatures, delivery, collections
- Next.js adapter available
- Active development

## Environment Variables

```env
# Generate with: openssl genrsa -out private.pem 2048
ACTIVITYPUB_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Generate with: openssl rsa -in private.pem -pubout -out public.pem
ACTIVITYPUB_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."

# Secret for triggering federation
ACTIVITYPUB_SECRET="random-secure-token"
```

## Files to Create

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
