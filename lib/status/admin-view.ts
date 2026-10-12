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
}) {
  const {
    signedIn,
    configured,
    csrf = '',
    snapshot,
    results = [],
    query = '',
    message = '',
  } = options;
  const e = escapeHtml;
  const guard = `<input type="hidden" name="csrf" value="${e(csrf)}">`;
  const content = !configured
    ? '<p>Admin sign-in needs Postgres and the owner authenticator configured on the server.</p>'
    : !signedIn
      ? `<p>Use your owner authenticator to edit your public status.</p><form method="post"><input type="hidden" name="action" value="signin"><label for="code">Authenticator code</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required><button>Sign in</button></form>`
      : `<section aria-labelledby="location-title"><h2 id="location-title">Current city</h2><p class="current">${e(snapshot?.location.city ?? '')}<span>${e([snapshot?.location.region, snapshot?.location.country].filter(Boolean).join(', '))}</span></p><p>${snapshot?.source === 'manual' ? 'You set this city manually.' : 'The server default is active.'} Location refreshes about every three hours. Saving here updates it immediately.</p><p class="subtle">The site publishes your city and local time. Coordinates stay on the server.</p></section><section aria-labelledby="search-title"><h2 id="search-title">Set a city</h2><form method="get"><label for="q">City name</label><div class="search"><input id="q" name="q" value="${e(query)}" minlength="2" maxlength="100" required placeholder="Search for a city"><button>Search</button></div></form>${query && !results.length ? '<p class="subtle">No cities found. Try another name.</p>' : ''}<div class="results">${results.map((city) => `<form method="post">${guard}<input type="hidden" name="action" value="save"><input type="hidden" name="city" value="${e(JSON.stringify(city))}"><div><strong>${e(city.city)}</strong><span>${e([city.region, city.country].filter(Boolean).join(', '))}</span><small>${e(city.timezone)}</small></div><button>Use this city</button></form>`).join('')}</div><p class="subtle">City search uses <a href="https://open-meteo.com/">Open-Meteo</a>. Docket sync is not connected.</p></section><form method="post" class="logout">${guard}<button name="action" value="signout">Sign out</button></form>`;
  const light = themeSchemes.light;
  const dark = themeSchemes.dark;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="same-origin"><title>Status admin · Willie</title><style>
@font-face{font-family:Atkinson;src:url('/fonts/AtkinsonHyperlegibleNext-Latin-Variable.woff2') format('woff2');font-weight:200 800;font-display:swap}
:root{color-scheme:light;--surface:${light.surface};--container:${light.surfaceContainer};--field:${light.surfaceContainerLowest};--text:${light.onSurface};--muted:${light.onSurfaceVariant};--primary:${light.primary};--on-primary:${light.onPrimary}}
@media(prefers-color-scheme:dark){:root{color-scheme:dark;--surface:${dark.surface};--container:${dark.surfaceContainer};--field:${dark.surfaceContainerLowest};--text:${dark.onSurface};--muted:${dark.onSurfaceVariant};--primary:${dark.primary};--on-primary:${dark.onPrimary}}}
*{box-sizing:border-box}body{margin:0;background:var(--surface);color:var(--text);font:16px/1.5 Atkinson,system-ui,sans-serif}main{width:min(100% - 40px,640px);margin:60px auto 80px}h1{font-size:clamp(32px,7vw,44px);letter-spacing:-.03em;font-weight:600;margin:32px 0 12px}h2{font-size:20px;font-weight:600;margin:0 0 12px}p{margin:12px 0}a{color:var(--primary);text-underline-offset:3px}section{margin-top:28px;padding:24px;border-radius:24px;background:var(--container)}.subtle,span,small{color:var(--muted)}.current{font-size:28px;line-height:1.3;margin:0 0 16px}.current span{font-size:16px;margin-top:4px}span,small{display:block;overflow-wrap:anywhere}label{display:block;margin:24px 0 8px}input{width:100%;min-width:0;min-height:52px;border:0;border-radius:12px;background:var(--field);color:var(--text);padding:12px 16px;font:inherit}button{min-height:48px;border:0;border-radius:24px;background:var(--primary);color:var(--on-primary);padding:12px 20px;font:600 16px/1.3 Atkinson,system-ui;cursor:pointer}form>button{margin-top:16px}.search{display:flex;gap:8px}.results{display:grid;gap:8px;margin-top:20px}.results form{display:flex;gap:16px;justify-content:space-between;align-items:center;background:var(--field);padding:16px;border-radius:16px}.results form>div{min-width:0}.results button{margin:0;flex-shrink:0}.logout button{background:var(--container);color:var(--text)}.message{padding:16px;border-radius:16px;background:var(--container)}:focus-visible{outline:3px solid var(--primary);outline-offset:3px}@media(max-width:440px){main{margin-top:28px}section{padding:20px}.results form{align-items:stretch;flex-direction:column}.results button{align-self:start}}
</style></head><body><main><a href="/">Willie</a><h1>Status admin</h1>${message ? `<p class="message" role="status">${e(message)}</p>` : ''}${content}</main></body></html>`;
}
