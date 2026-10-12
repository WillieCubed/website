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
  const regionLabel = (city?: City) =>
    [city?.region, city?.country === 'United States' ? 'US' : city?.country]
      .filter(Boolean)
      .join(', ');
  const selectedCity =
    message === 'Could not save. Try again.' ? results[0] : undefined;
  const regionVisible =
    !editing || !query || query === snapshot?.location.city || !!selectedCity;
  const content = !configured
    ? '<p>Sign-in is unavailable.</p>'
    : !signedIn
      ? `<form method="post" class="signin"><input type="hidden" name="action" value="signin"><label for="code">Authenticator code</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required><button>Sign in</button></form>`
      : `<section class="editor" aria-labelledby="location-title" data-location-editor data-editing="${editing}"><header class="field-heading"><h2 id="location-title">Location</h2><a class="edit-control" href="${editing ? '/admin/status' : '/admin/status?edit=1'}" data-edit-button aria-controls="city-field">${editing ? 'Cancel' : 'Edit'}</a></header><div class="location" role="region" aria-label="Current city"><p class="city" data-city-display ${editing ? 'hidden' : ''}>${e(snapshot?.location.city ?? '')}</p><form method="get" data-location-form ${editing ? '' : 'hidden'}><input type="hidden" name="edit" value="1"><input id="city-field" class="city-input" role="combobox" aria-label="City" aria-autocomplete="list" aria-controls="city-results" aria-expanded="${results.length > 0}" autocomplete="off" name="q" value="${e(query || snapshot?.location.city || '')}" minlength="2" maxlength="100" required data-city-input></form><p class="region" data-saved-region="${e(regionLabel(snapshot?.location))}" ${regionVisible ? '' : 'hidden'}>${e(regionLabel(selectedCity || snapshot?.location))}</p></div><p class="message" role="status" data-city-status ${!message && !(query && !results.length) ? 'hidden' : ''}>${message === 'City updated.' ? 'Saved' : e(message || (query && !results.length ? 'No cities found.' : ''))}</p><div id="city-results" class="results" role="listbox" aria-label="Cities" ${!editing || !results.length ? 'hidden' : ''}>${results.map((city, index) => `<form method="post" role="presentation">${guard}<input type="hidden" name="action" value="save"><input type="hidden" name="city" value="${e(JSON.stringify(city))}"><button type="submit" role="option" aria-selected="false" id="city-option-${index}"><strong>${e(city.city)}</strong><span>${e([city.region, city.country === 'United States' ? 'US' : city.country].filter(Boolean).join(', '))}</span></button></form>`).join('')}</div><a class="credit" href="https://open-meteo.com/">Open-Meteo</a></section>`;
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
.editor{padding:20px 24px 24px;border-radius:24px;background:var(--container)}
.field-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px;min-height:44px}
.editor h2{font-size:20px;line-height:1.3;font-weight:600;margin:0}
.edit-control{display:flex;align-items:center;justify-content:center;min-height:44px;min-width:64px;padding:8px 12px;margin-right:-12px;border-radius:22px;color:var(--primary);text-decoration:none;font-size:14px;font-weight:600}
.edit-control:hover{background:var(--field)}
.edit-control[aria-disabled="true"]{opacity:.5;pointer-events:none}
.location{min-width:0}
.city{font-size:24px;line-height:1.3;font-weight:500;margin:0;overflow-wrap:anywhere}
.region{color:var(--muted);font-size:14px;margin:8px 0 0;overflow-wrap:anywhere}
label{display:block;font-size:14px;font-weight:500;margin-bottom:8px}
input{width:100%;min-width:0;min-height:52px;border:0;border-radius:12px;background:var(--field);color:var(--text);padding:12px 16px;font:inherit}
button{min-height:48px;border:0;border-radius:24px;background:var(--primary);color:var(--on-primary);padding:12px 20px;font:600 16px/1.3 Atkinson,system-ui;cursor:pointer}
button:hover{filter:brightness(.95)}
button:disabled{opacity:.55;cursor:wait;filter:none}
.city-input{padding:10px 12px;margin-left:-12px;width:calc(100% + 24px);min-height:52px;background:var(--field);font-size:24px;line-height:1.3;font-weight:500}
[hidden]{display:none!important}
.results{display:grid;gap:4px;margin-top:16px}
.results form{margin:0}
.results button{display:block;text-align:left;width:100%;padding:12px 16px;border-radius:12px;background:var(--field);color:var(--text);font-weight:400}
.results strong{font-size:16px;font-weight:600}
.results button:hover,.results button[aria-selected="true"]{background:var(--primary);color:var(--on-primary)}
.results span{display:block;color:var(--muted);font-size:14px;margin-top:2px;overflow-wrap:anywhere}
.results button:hover span,.results button[aria-selected="true"] span{color:inherit}
.logout button{background:transparent;color:var(--muted);padding:8px 0;min-height:44px;font-weight:500}
.credit{display:block;width:fit-content;margin-top:24px;color:var(--muted);font-size:12px}
.message{margin:16px 0 0;font-size:14px;color:var(--primary)}

.empty{margin:20px 0 0;color:var(--muted)}
.signin>button{margin-top:16px}
:focus-visible{outline:3px solid var(--primary);outline-offset:3px}
@media(max-width:440px){main{margin-top:20px}.editor{padding:16px 20px 20px}}
</style></head><body><main><nav aria-label="Admin"><a href="/">Willie</a>${signedIn ? `<form method="post" class="logout">${guard}<button name="action" value="signout">Sign out</button></form>` : ''}</nav><h1>Status</h1>${message && !signedIn ? `<p class="message" role="status">${e(message)}</p>` : ''}${content}</main><script type="module" src="/status-editor.js"></script></body></html>`;
}
