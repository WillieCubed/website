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
<title>${escapeHtml(title)} · ${escapeHtml(site.name)}</title>
<style>
:root{color-scheme:light dark;--primary:${light.primary};--on-primary:${light.surface};--surface:${light.surface};--on-surface:${light.onSurface};--muted:${light.onSurfaceVariant};--outline:${light.outlineVariant}}
@media(prefers-color-scheme:dark){:root{--primary:${dark.primary};--on-primary:${dark.surface};--surface:${dark.surface};--on-surface:${dark.onSurface};--muted:${dark.onSurfaceVariant};--outline:${dark.outlineVariant}}}
*{box-sizing:border-box}
body{margin:0;padding:40px 16px;background:var(--surface);color:var(--on-surface);font:16px/1.6 system-ui,sans-serif}
main{max-width:520px;margin:0 auto}
h1{margin:0 0 .5rem;font-size:1.5rem;line-height:1.3}
p{margin:0 0 1rem}
.muted{color:var(--muted);font-size:.9375rem;overflow-wrap:anywhere}
.error{padding:.75rem 1rem;border:1px solid var(--outline);border-radius:12px;font-weight:600}
fieldset{margin:1.5rem 0;padding:0;border:0}
legend{margin-bottom:.5rem;font-weight:600}
label.scope{display:flex;gap:.625rem;align-items:baseline;padding:.375rem 0}
label.code{display:block;margin:1.5rem 0 .5rem;font-weight:600}
input[type=text]{width:100%;max-width:12rem;padding:.625rem .75rem;border:1px solid var(--outline);border-radius:12px;background:transparent;color:inherit;font:1.25rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.2em}
.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}
button{padding:.625rem 1.25rem;border:1px solid var(--outline);border-radius:999px;background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer}
button[value=approve]{border-color:var(--primary);background:var(--primary);color:var(--on-primary)}
:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
</style>
</head>
<body>
<main>
${body}
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
    ? `<fieldset>
<legend>It asks to</legend>
${request.scope
  .map(
    (scope) =>
      `<label class="scope"><input type="checkbox" name="grant" value="${scope}" checked> ${escapeHtml(SCOPE_DESCRIPTIONS[scope] ?? scope)}</label>`
  )
  .join('\n')}
</fieldset>`
    : '<p>It only asks to confirm who you are.</p>';
  const code =
    prompt === 'code'
      ? `<label class="code" for="code">Code from your authenticator app</label>
<input type="text" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" required autofocus>`
      : '';

  return document(
    `Sign in to ${clientName}`,
    `<h1>Sign in to ${escapeHtml(clientName)}</h1>
<p class="muted">As ${escapeHtml(me)}</p>
<p class="muted">${escapeHtml(request.clientId)} will return to ${escapeHtml(new URL(request.redirectUri).origin)}</p>
${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
<form method="post" action="${INDIEAUTH_CONSENT_ENDPOINT}">
${hidden('response_type', 'code')}
${hidden('client_id', request.clientId)}
${hidden('redirect_uri', request.redirectUri)}
${hidden('state', request.state)}
${hidden('code_challenge', request.codeChallenge)}
${hidden('code_challenge_method', 'S256')}
${hidden('scope', request.scope.join(' '))}
${scopes}
${code}
<div class="actions">
<button type="submit" name="decision" value="approve">Approve</button>
<button type="submit" name="decision" value="deny" formnovalidate>Deny</button>
</div>
</form>`
  );
}

/** A page that explains why a sign-in cannot go ahead. */
export function renderSignInMessage(title: string, message: string): string {
  return document(
    title,
    `<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p>`
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
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
      'Referrer-Policy': 'no-referrer',
    },
  });
}
