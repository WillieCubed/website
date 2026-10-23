# IndieAuth

<a id="indieauth"></a>

Maintainers and client authors use this reference to inspect owner authorization, token lifetimes, and replay handling. The server authorizes the site owner. Visitor authorization through AT Protocol uses a separate [OAuth client](atproto.md). The [configuration reference](indieweb-configuration.md) owns the required bindings and secrets.

## Identity discovery

The site is its own IndieAuth server
([indieauth.spec.indieweb.org](https://indieauth.spec.indieweb.org/)), so
signing in to a Micropub client as `https://willie.page/` never leaves this
domain. Clients find it through `<link rel="indieauth-metadata">` in the head,
which points at `/.well-known/oauth-authorization-server`. The head also keeps
`rel="authorization_endpoint"` and `rel="token_endpoint"` for older clients,
every page repeats them in its HTTP `Link` header, and WebFinger returns the
same three links. All three render `INDIEAUTH_DISCOVERY_LINKS` from
`lib/indieweb/discovery-links.ts`, so they cannot disagree.

## Authorization and single-use codes

The publishing client starts authorization in the owner's browser. PKCE binds
the later code exchange to the client that initiated it: the request carries an
S256 challenge, and redemption must supply its matching verifier. The site
requires S256 and `state`; it refuses the `plain` challenge method.

1. The client sends the browser to `/indieauth/auth` with `client_id`,
   `redirect_uri`, `state`, `code_challenge`, and the requested scopes.
2. The endpoint forwards to `/indieauth/consent`, which validates the client
   and return address. The redirect must use the client's scheme, host, and port,
   or appear in its registered metadata.
3. Cloudflare Access verifies the owner before the consent page presents the
   client and scope checkboxes. Willie approves the scopes left checked. The
   client receives a code with `state` and `iss`; denial returns
   `error=access_denied`.
4. The client redeems the code with `code_verifier`: `/indieauth/token` issues
   an access token, while `/indieauth/auth` returns the profile URL alone. A code
   lasts ten minutes and is spent on its first redemption attempt, valid or not.
   A code issued without scopes redeems only at `/indieauth/auth`.

Client metadata can be JSON whose `client_id` is its own URL and whose
`redirect_uris` lists permitted return addresses, or HTML with
`<link rel="redirect_uri">`. Its JSON `client_name` or HTML `h-app` supplies the
name shown to Willie. An invalid `client_id` or `redirect_uri` is shown to the
owner; other request errors return to the client.

Metadata retrieval is itself an untrusted fetch. The server checks every resolved
address when connecting to stop DNS rebinding, follows at most three redirects
with checks at each hop, and caps the response at 1 MB. It never fetches a
`localhost` client and uses defaults instead. These restrictions apply before
owner approval: anyone can initiate the metadata request.

## Consent presentation

The consent page is for the site owner. It presents the client and requested
access first, with the Access-verified owner deciding approval in the form.
The client address stays visible below its name. A native **Request details**
disclosure exposes the complete client, return, and identity URLs.

The route renders HTML outside the site's React layout. It uses the site's text
navigation, Material surface roles from `lib/theme/tokens.ts`, and variable Atkinson
faces from `public/fonts`. Update those public copies when the site's fonts
change.

## Token endpoints and operator inspection

New access tokens last one hour and refresh authorization expires after 90 days
of inactivity. Existing access tokens retain their recorded expiry. The refresh
and UserInfo section below describes client binding and replay revocation.

| Endpoint                                   | Answers                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `POST /indieauth/token`                    | `{ access_token, token_type, scope, me, expires_in, profile? }`, or revokes with `action=revoke&token=` for older clients |
| `GET /indieauth/token` with a bearer token | `{ me, client_id, scope }`, or 401 for a token that is not active                                                         |
| `POST /indieauth/introspect` with `token=` | `{ active, me, client_id, scope, iat, exp }`; needs `Authorization: Bearer $INDIEAUTH_INTROSPECTION_SECRET`               |
| `POST /indieauth/revoke` with `token=`     | 200 whether or not the token existed                                                                                      |

Inspect active access grants with `SELECT client_id, scope, issued_at FROM
indieauth_tokens WHERE revoked_at IS NULL`. Revocation through the protocol
endpoint also revokes the associated refresh family. Setting only an access
row's `revoked_at` leaves its refresh grant able to issue another access token.
The grants module owns issuance and revocation, the endpoint module owns HTTP,
and storage owns the atomic database changes.

## Owner sign-in

Cloudflare Access protects `/indieauth/consent` on the canonical hostname. The
Worker independently verifies `Cf-Access-Jwt-Assertion` against the configured
signing keys, issuer, audience, expiry, and owner email. A direct Worker URL
therefore cannot bypass owner verification merely by avoiding the Access edge.

Configure `OWNER_ACCESS_ISSUER`, `OWNER_ACCESS_AUDIENCE`, and
`OWNER_ACCESS_EMAIL` for the intended Worker. `lib/owner/access.ts` supplies the
shared authenticator, so the form asks which client scopes to approve rather
than requesting a TOTP code. The removed TOTP setup command
and earlier enrollment records do not describe current owner sign-in.

External clients need the other IndieAuth endpoints to remain public. Protecting
the whole protocol behind owner-browser Access would prevent those clients from
exchanging and verifying tokens. The consent POST also checks `Sec-Fetch-Site`,
then `Origin`, and refuses a request with neither header.

## Bot challenges

A machine client cannot complete a browser challenge just because an ordinary
browser can open the homepage. Before enabling a Cloudflare WAF or bot challenge,
keep the protocol endpoints reachable by their intended clients and verify that
path independently of owner-browser sign-in.

The affected paths include `/indieauth/`, `/micropub`,
`/.well-known/oauth-authorization-server`,
`/.well-known/site.standard.publication`, and `/.well-known/atproto-did`.
The publisher also fetches `/writings/*/opengraph-image` and `/brand/social/*`
from the live site for record images. Challenge exceptions for those machine
requests do not remove the signed owner check on `/indieauth/consent` or authorize
making the private preview public.

## Refresh and UserInfo

### Refresh families and scope

An access token authorizes requests for a limited time. A refresh token lets its
client obtain replacement credentials without sending the owner through consent
again. `/indieauth/token` accepts `grant_type=refresh_token`, `refresh_token`,
and `client_id` for that exchange.

Each successful refresh hashes and spends the old credential atomically and
issues the next one in the same authorization family. The family stays bound to
its original client and permitted scopes; rotation rejects escalation. Reusing
a spent refresh credential revokes the whole family rather than treating it as
a second successful refresh.

New access tokens last one hour. Each refresh starts a 90-day inactivity deadline;
legacy access tokens keep their recorded expiry. `/indieauth/userinfo` returns
identity and only the profile/email fields permitted by the active token's
scopes. Server metadata advertises refresh and UserInfo. These additions do not
remove the S256 PKCE requirement for initial authorization.

### Identity-only grants and code replay

A scope-free code returns only the profile URL and never creates access or
refresh credentials.

Reusing an authorization code revokes every token in its grant. Migration 009
serializes replay and token issuance on the code row. The server retains spent
code digests to preserve that association across refreshes. It removes only
expired unused codes. Existing grants without an association and legacy access
tokens retain their recorded expiry.
