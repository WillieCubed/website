import { INDIEAUTH_CONSENT_ENDPOINT } from '@/lib/indieweb/constants';
import type {
  IndieAuthAuthorizationRequest,
  IndieAuthClientInfo,
} from '@/lib/indieweb/types';
import { site } from '@/lib/site';
import { themeSchemes } from '@/lib/theme';

/**
 * The owner-facing pages of the IndieAuth server: the consent form and the
 * messages shown when a request cannot go ahead. Route handlers cannot load
 * app/globals.css, so, like `lib/plain-page.ts`, these carry the theme's
 * values inline.
 */

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  profile: 'See your name, photo, and profile URL',
  email: 'See your email address',
  create: 'Publish new posts',
  draft: 'Create drafts',
  update: 'Edit posts',
  delete: 'Delete posts',
  undelete: 'Restore deleted posts',
  media: 'Upload photos',
};

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function document(title: string, body: string): string {
  const light = themeSchemes.light;
  const dark = themeSchemes.dark;
  return `<!doctype html>
<html lang="${site.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="${light.surface}">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${dark.surface}">
<title>${escapeHtml(title)} · ${escapeHtml(site.name)}</title>
<style>
@font-face{font-family:Atkinson;src:url('/fonts/AtkinsonHyperlegibleNext-Latin-Variable.woff2') format('woff2');font-weight:200 800;font-display:swap}
@font-face{font-family:AtkinsonMono;src:url('/fonts/AtkinsonHyperlegibleMono-Latin-Variable.woff2') format('woff2');font-weight:200 800;font-display:swap}
:root{color-scheme:light;--primary:${light.primary};--on-primary:${light.onPrimary};--surface:${light.surface};--container-lowest:${light.surfaceContainerLowest};--container:${light.surfaceContainer};--container-high:${light.surfaceContainerHigh};--container-highest:${light.surfaceContainerHighest};--on-surface:${light.onSurface};--muted:${light.onSurfaceVariant};--outline:${light.outlineVariant}}
@media(prefers-color-scheme:dark){:root{color-scheme:dark;--primary:${dark.primary};--on-primary:${dark.onPrimary};--surface:${dark.surface};--container-lowest:${dark.surfaceContainerLowest};--container:${dark.surfaceContainer};--container-high:${dark.surfaceContainerHigh};--container-highest:${dark.surfaceContainerHighest};--on-surface:${dark.onSurface};--muted:${dark.onSurfaceVariant};--outline:${dark.outlineVariant}}}
*{box-sizing:border-box}
html{min-height:100%}
body{margin:0;min-height:100vh;background:var(--surface);color:var(--on-surface);font:400 16px/1.5 Atkinson,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.topbar,.shell{width:min(calc(100% - 32px),620px);margin-inline:auto}
.topbar{display:flex;align-items:center;gap:12px;padding:30px 32px 0;font-size:14px;font-weight:600}
.topbar a{color:var(--on-surface);text-decoration:none}
.topbar a:hover{text-decoration:underline;text-decoration-color:var(--primary);text-underline-offset:4px}
.topbar .slash,.topbar .current{color:var(--muted)}
.shell{padding:48px 0 72px}
.content{max-width:100%}
h1{margin:0;font-size:32px;font-weight:500;letter-spacing:-.025em;line-height:1.2;overflow-wrap:anywhere}
h1 strong{font-weight:650}
.title-verb{white-space:nowrap}
p{margin:0}
.consent{overflow:hidden;border-radius:28px;background:var(--container-high)}
.request-heading{padding:32px 32px 0}
.client-address{margin-top:10px;color:var(--muted);font:400 13px/1.5 AtkinsonMono,ui-monospace,monospace;overflow-wrap:anywhere}
.permissions{min-width:0;margin:28px 32px;padding:0;border:0}
legend{max-width:100%;padding:0;font-size:16px;font-weight:600;overflow-wrap:anywhere}
.scope-list{display:grid;gap:3px;margin-top:12px}
label.scope{display:flex;align-items:center;gap:12px;min-height:56px;padding:14px 16px;border-radius:5px;background:var(--container);cursor:pointer;transition:background-color 180ms ease}
label.scope:first-child{border-start-start-radius:16px;border-start-end-radius:16px}
label.scope:last-child{border-end-start-radius:16px;border-end-end-radius:16px}
label.scope:hover,label.scope:focus-within{background:var(--container-highest)}
input[type=checkbox]{width:18px;height:18px;flex:none;margin:0;accent-color:var(--primary)}
.verification{padding:24px 32px 32px;background:var(--container)}
.identity{color:var(--muted);font-size:14px;overflow-wrap:anywhere}
.identity strong{color:var(--on-surface);font-weight:600}
label.code{display:block;margin:20px 0 10px;font-size:16px;font-weight:600}
input[type=text]{display:block;width:100%;min-height:60px;padding:12px 18px;border:2px solid transparent;border-radius:16px;background:var(--container-lowest);color:inherit;font:500 24px/1.2 AtkinsonMono,ui-monospace,monospace;letter-spacing:.18em;text-align:center;transition:border-color 180ms ease}
input[type=text]::placeholder{color:var(--muted);opacity:.55}
input[type=text]:focus{border-color:var(--primary);outline:none}
.hint{margin:28px 32px;color:var(--muted)}
.error{margin-top:16px;color:var(--on-surface);font-weight:600}
.actions{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:12px;margin-top:24px}
button{display:flex;justify-content:center;align-items:center;gap:12px;min-height:52px;padding:12px 20px;border:0;border-radius:999px;background:var(--container-highest);color:inherit;font:600 16px/1.2 Atkinson,system-ui,sans-serif;cursor:pointer;transition:background-color 180ms ease,border-radius 180ms ease,transform 180ms ease}
button[value=approve]{background:var(--primary);color:var(--on-primary)}
button:hover{border-radius:18px;filter:brightness(.97)}
button:active{transform:scale(.98)}
button svg{width:18px;height:18px;flex:none}
:focus-visible{outline:2px solid var(--primary);outline-offset:4px}
.request-details{margin:16px 16px 0;color:var(--muted);font-size:14px}
.request-details summary{display:flex;align-items:center;gap:8px;width:fit-content;min-height:44px;padding:8px 16px;border-radius:12px;cursor:pointer;list-style:none}
.request-details summary::-webkit-details-marker{display:none}
.request-details summary:hover{background:var(--container)}
.request-details summary svg{width:16px;height:16px;transition:transform 180ms ease}
.request-details[open] summary svg{transform:rotate(90deg)}
.request-details dl{display:grid;gap:16px;margin:12px 16px 0;padding:0}
.request-details dt{margin-bottom:4px}
.request-details dd{margin:0;color:var(--on-surface);overflow-wrap:anywhere}
.request-details code{font:400 13px/1.5 AtkinsonMono,ui-monospace,monospace}
.message{padding:32px;border-radius:28px;background:var(--container-high)}
.message p{margin-top:16px;color:var(--muted)}
@media(max-width:600px){.topbar{gap:10px;padding:24px 24px 0;font-size:13px}.shell{padding:32px 0 40px}.consent,.message{border-radius:24px}.request-heading{padding:24px 24px 0}h1{font-size:28px}.permissions{margin:24px}.verification{padding:22px 24px 24px}.hint{margin:24px}.actions{gap:10px}.actions button{padding-inline:16px}.request-details{margin-inline:8px}.message{padding:24px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important}}
</style>
</head>
<body>
<header class="topbar"><a href="${escapeHtml(site.origin)}">${escapeHtml(site.author.name)}</a><span class="slash">/</span><span class="current">Sign in</span></header>
<main class="shell">
<div class="content">
${body}
</div>
</main>
</body>
</html>
`;
}

function hidden(name: string, value: string): string {
  return `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;
}

export interface ConsentPageOptions {
  request: IndieAuthAuthorizationRequest;
  client: IndieAuthClientInfo;
  me: string;
  prompt: 'code' | 'none';
  error?: string;
}

/**
 * The consent form. Each requested scope is a checkbox the owner may clear
 * before approving; the original request travels in hidden fields and is
 * checked again when the form comes back.
 */
export function renderConsentPage({
  request,
  client,
  me,
  prompt,
  error,
}: ConsentPageOptions): string {
  const clientName = client.name ?? new URL(request.clientId).host;
  const scopes = request.scope.length
    ? `<fieldset class="permissions">
<legend>Allow ${escapeHtml(clientName)} to</legend>
<div class="scope-list">
${request.scope
  .map(
    (scope) =>
      `<label class="scope"><input type="checkbox" name="grant" value="${scope}" checked> ${escapeHtml(SCOPE_DESCRIPTIONS[scope] ?? scope)}</label>`
  )
  .join('\n')}
</div>
</fieldset>`
    : '<p class="hint">This request only confirms who you are.</p>';
  const code =
    prompt === 'code'
      ? `<label class="code" for="code">Code from your authenticator app</label>
<input type="text" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" placeholder="000 000"${error ? ' aria-invalid="true" aria-describedby="code-error"' : ''} required autofocus>`
      : '';

  return document(
    `Sign in to ${clientName}`,
    `<div class="consent">
<header class="request-heading">
<h1><span class="title-verb">Sign in to</span> <strong>${escapeHtml(clientName)}</strong></h1>
<p class="client-address">${escapeHtml(request.clientId)}</p>
</header>
<form class="consent-form" method="post" action="${INDIEAUTH_CONSENT_ENDPOINT}">
${hidden('response_type', 'code')}
${hidden('client_id', request.clientId)}
${hidden('redirect_uri', request.redirectUri)}
${hidden('state', request.state)}
${hidden('code_challenge', request.codeChallenge)}
${hidden('code_challenge_method', 'S256')}
${hidden('scope', request.scope.join(' '))}
${scopes}
<div class="verification">
<p class="identity">Signing in as <strong title="${escapeHtml(me)}">${escapeHtml(me.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</strong></p>
${error ? `<p class="error" id="code-error" role="alert">${escapeHtml(error)}</p>` : ''}
${code}
<div class="actions">
<button type="submit" name="decision" value="approve">Approve<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button>
<button type="submit" name="decision" value="deny" formnovalidate>Deny</button>
</div>
</div>
</form>
</div>
<details class="request-details">
<summary><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>Request details</summary>
<dl>
<div><dt>Requested by</dt><dd><code>${escapeHtml(request.clientId)}</code></dd></div>
<div><dt>Return to</dt><dd><code>${escapeHtml(request.redirectUri)}</code></dd></div>
<div><dt>Signing in as</dt><dd><code>${escapeHtml(me)}</code></dd></div>
</dl>
</details>`
  );
}

/** A page that explains why a sign-in cannot go ahead. */
export function renderSignInMessage(title: string, message: string): string {
  return document(
    title,
    `<div class="message"><h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p></div>`
  );
}

/**
 * Consent pages are never cached, indexed, framed, or leaked in a Referer.
 * Framing is refused so another site cannot overlay the Approve button.
 */
export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'",
      'Referrer-Policy': 'no-referrer',
    },
  });
}
