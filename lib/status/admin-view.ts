import { themeSchemes } from '@/lib/theme';

import type { City, LocationSnapshot } from './location';

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!
  );
}
export function adminView(options: {
  signedIn?: boolean;
  configured: boolean;
  csrf?: string;
  snapshot?: LocationSnapshot;
  results?: City[];
  query?: string;
  message?: string;
  editing?: boolean;
}) {
  const {
    signedIn,
    configured,
    csrf = '',
    snapshot,
    results = [],
    query = '',
    message = '',
    editing = false,
  } = options;
  const e = escapeHtml;
  const guard = `<input type="hidden" name="csrf" value="${e(csrf)}">`;
  const content = !configured
    ? '<p>Sign-in is unavailable.</p>'
    : !signedIn
      ? `<form method="post" class="signin"><input type="hidden" name="action" value="signin"><label for="code">Authenticator code</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required><button>Sign in</button></form>`
      : `<section class="editor" aria-labelledby="location-title"><h2 id="location-title">Location</h2><form method="get" class="location-row" data-location-form data-editing="${editing}"><input type="hidden" name="edit" value="1"><div class="value-container" role="region" aria-label="Current city"><p class="city" data-city-display ${editing ? 'hidden' : ''}>${e(snapshot?.location.city ?? '')}</p><input class="city-input" aria-label="City" name="q" value="${e(query || snapshot?.location.city || '')}" minlength="2" maxlength="100" required data-city-input ${editing ? '' : 'hidden disabled'}><p class="region">${e([snapshot?.location.region, snapshot?.location.country === 'United States' ? 'US' : snapshot?.location.country].filter(Boolean).join(', '))}</p></div><button data-edit-button>${editing ? 'Search' : 'Edit'}</button></form>${message ? `<p class="message" role="status">${message === 'City updated.' ? 'Saved' : e(message)}</p>` : ''}${query && !results.length && !message ? '<p class="empty">No cities found.</p>' : ''}<div class="results">${results.map((city) => `<form method="post">${guard}<input type="hidden" name="action" value="save"><input type="hidden" name="city" value="${e(JSON.stringify(city))}"><div><strong>${e(city.city)}</strong><span>${e([city.region, city.country === 'United States' ? 'US' : city.country].filter(Boolean).join(', '))}</span></div><button>Set city</button></form>`).join('')}</div><div class="field-footer"><a class="credit" href="https://open-meteo.com/">Open-Meteo</a><a href="/admin/status" data-cancel ${editing ? '' : 'hidden'}>Cancel</a></div></section>`;
  const light = themeSchemes.light;
  const dark = themeSchemes.dark;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="same-origin"><title>Status admin · Willie</title><style>
@font-face{font-family:Atkinson;src:url('/fonts/AtkinsonHyperlegibleNext-Latin-Variable.woff2') format('woff2');font-weight:200 800;font-display:swap}
:root{color-scheme:light;--surface:${light.surface};--container:${light.surfaceContainer};--field:${light.surfaceContainerLowest};--text:${light.onSurface};--muted:${light.onSurfaceVariant};--primary:${light.primary};--on-primary:${light.onPrimary}}
@media(prefers-color-scheme:dark){:root{color-scheme:dark;--surface:${dark.surface};--container:${dark.surfaceContainer};--field:${dark.surfaceContainerLowest};--text:${dark.onSurface};--muted:${dark.onSurfaceVariant};--primary:${dark.primary};--on-primary:${dark.onPrimary}}}
*{box-sizing:border-box}
body{margin:0;background:var(--surface);color:var(--text);font:16px/1.5 Atkinson,system-ui,sans-serif}
main{width:min(100% - 40px,560px);margin:48px auto 80px}
nav{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:48px}
a{color:var(--primary);text-underline-offset:3px}
h1{font-size:32px;letter-spacing:-.025em;font-weight:600;margin:36px 0 32px}
.editor h2{font-size:20px;line-height:1.3;font-weight:600;margin:0 0 12px;padding-inline:16px}
.location-row{display:flex;align-items:center;gap:12px}
.value-container{flex:1;min-width:0;padding:16px;border-radius:16px;background:var(--container)}
.city{font-size:24px;line-height:1.3;font-weight:500;margin:0;overflow-wrap:anywhere}
.region{color:var(--muted);font-size:14px;margin:4px 0 0;overflow-wrap:anywhere}
.editor{padding:0}
label{display:block;font-size:14px;font-weight:500;margin-bottom:8px}
input{width:100%;min-width:0;min-height:52px;border:0;border-radius:12px;background:var(--field);color:var(--text);padding:12px 16px;font:inherit}
button{min-height:48px;border:0;border-radius:24px;background:var(--primary);color:var(--on-primary);padding:12px 20px;font:600 16px/1.3 Atkinson,system-ui;cursor:pointer}
button:hover{filter:brightness(.95)}
.city-input{padding:0;min-height:31px;border-radius:0;background:transparent;font-size:24px;line-height:1.3;font-weight:500}
.value-container:focus-within{outline:2px solid var(--primary);outline-offset:2px}
.city-input:focus-visible{outline:none}
.location-row>button{flex-shrink:0}
[data-editing="false"]>button{background:var(--container);color:var(--primary)}
[hidden]{display:none!important}
.results{display:grid;gap:8px}
.results:not(:empty){margin-top:20px}
.results form{display:flex;gap:16px;justify-content:space-between;align-items:center;background:var(--field);padding:16px;border-radius:16px}
.results form>div{min-width:0}
.results button{flex-shrink:0}
.results span{display:block;color:var(--muted);font-size:14px;overflow-wrap:anywhere}
.logout button{background:transparent;color:var(--muted);padding:8px 0;min-height:44px;font-weight:500}
.field-footer{display:flex;align-items:center;gap:20px;padding:12px 16px 0;min-height:44px}
.field-footer a{color:var(--muted);font-size:12px}
.field-footer [data-cancel]{font-size:14px}
.message{margin:16px 0 0;font-size:14px;color:var(--primary)}

.empty{margin:20px 0 0;color:var(--muted)}
.signin>button{margin-top:16px}
:focus-visible{outline:3px solid var(--primary);outline-offset:3px}
@media(max-width:440px){main{margin-top:20px}.results form{align-items:stretch;flex-direction:column}.results button{align-self:start}}
</style></head><body><main><nav aria-label="Admin"><a href="/">Willie</a>${signedIn ? `<form method="post" class="logout">${guard}<button name="action" value="signout">Sign out</button></form>` : ''}</nav><h1>Status</h1>${message && !signedIn ? `<p class="message" role="status">${e(message)}</p>` : ''}${content}</main><script type="module" src="/status-editor.js"></script></body></html>`;
}
