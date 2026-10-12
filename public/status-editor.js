/* global document, AbortController, fetch, DOMParser, URL, URLSearchParams, FormData, setTimeout, clearTimeout */
function mountEditor(editor) {
  const form = editor.querySelector('[data-location-form]');
  const input = editor.querySelector('[data-city-input]');
  const display = editor.querySelector('[data-city-display]');
  const control = editor.querySelector('[data-edit-button]');
  const results = editor.querySelector('#city-results');
  const status = editor.querySelector('[data-city-status]');
  const savedCity = display.textContent;
  const region = editor.querySelector('.region');
  const savedRegion = region.dataset.savedRegion;
  let timer;
  let request;
  let sequence = 0;
  let selected = -1;
  let saving = false;

  function message(text) {
    status.textContent = text;
    status.hidden = !text;
  }

  function clearSearch() {
    clearTimeout(timer);
    request?.abort();
    sequence++;
    selected = -1;
    results.replaceChildren();
    results.hidden = true;
    results.removeAttribute('aria-busy');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    message('');
  }

  function setEditing(editing) {
    clearSearch();
    editor.dataset.editing = String(editing);
    display.hidden = editing;
    form.hidden = !editing;
    input.value = savedCity;
    region.textContent = savedRegion;
    region.hidden = false;
    control.textContent = editing ? 'Cancel' : 'Edit';
    control.href = editing ? '/admin/status' : '/admin/status?edit=1';
    if (editing) {
      input.focus();
      input.select();
    } else control.focus();
  }

  async function search() {
    const query = input.value.trim();
    if (query.length < 2 || editor.dataset.editing !== 'true') return;
    request = new AbortController();
    const current = ++sequence;
    const url = new URL(form.action);
    url.search = new URLSearchParams({ edit: '1', q: query }).toString();
    results.setAttribute('aria-busy', 'true');
    message('Searching…');
    try {
      const response = await fetch(url, {
        signal: request.signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Search unavailable');
      const next = new DOMParser().parseFromString(
        await response.text(),
        'text/html'
      );
      if (current !== sequence) return;
      const nextResults = next.querySelector('#city-results');
      if (!nextResults) {
        message('Sign in again to edit your location.');
        return;
      }
      results.innerHTML = nextResults.innerHTML;
      results.hidden = !results.querySelector('[role="option"]');
      input.setAttribute('aria-expanded', String(!results.hidden));
      message(next.querySelector('[data-city-status]')?.textContent || '');
    } catch (error) {
      if (current === sequence && error.name !== 'AbortError')
        message('Search is unavailable. Try again.');
    } finally {
      if (current === sequence) results.removeAttribute('aria-busy');
    }
  }

  results.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    const body = new URLSearchParams(new FormData(event.target));
    clearTimeout(timer);
    request?.abort();
    sequence++;
    results.setAttribute('aria-busy', 'true');
    control.setAttribute('aria-disabled', 'true');
    input.disabled = true;
    const choice = JSON.parse(body.get('city'));
    region.textContent = [
      choice.region,
      choice.country === 'United States' ? 'US' : choice.country,
    ]
      .filter(Boolean)
      .join(', ');
    region.hidden = false;
    const buttons = [...results.querySelectorAll('button')];
    buttons.forEach((button) => (button.disabled = true));
    message('Saving…');
    try {
      const response = await fetch(
        event.target.getAttribute('action') || '/admin/status',
        {
          method: 'POST',
          body,
          cache: 'no-store',
        }
      );
      const next = new DOMParser().parseFromString(
        await response.text(),
        'text/html'
      );
      const replacement = next.querySelector('[data-location-editor]');
      if (replacement) {
        editor.replaceWith(replacement);
        mountEditor(replacement);
        replacement.querySelector('[data-edit-button]').focus();
        return;
      }
      message(
        response.status === 401
          ? 'Sign in again to edit your location.'
          : 'Could not save. Try again.'
      );
    } catch {
      message('Could not save. Try again.');
    } finally {
      saving = false;
      buttons.forEach((button) => (button.disabled = false));
      input.disabled = false;
      control.removeAttribute('aria-disabled');
      results.removeAttribute('aria-busy');
    }
  });

  control.addEventListener('click', (event) => {
    event.preventDefault();
    if (saving) return;
    setEditing(editor.dataset.editing !== 'true');
  });
  input.addEventListener('input', () => {
    clearSearch();
    region.hidden =
      input.value.trim().toLowerCase() !== savedCity.trim().toLowerCase();
    region.textContent = savedRegion;
    if (input.value.trim().length >= 2) timer = setTimeout(search, 300);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearSearch();
    search();
  });
  input.addEventListener('keydown', (event) => {
    if (saving) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditing(false);
      return;
    }
    const options = [...results.querySelectorAll('[role="option"]')];
    if (event.key === 'Enter' && selected >= 0) {
      event.preventDefault();
      options[selected].form.requestSubmit(options[selected]);
    } else if (['ArrowDown', 'ArrowUp'].includes(event.key) && options.length) {
      event.preventDefault();
      selected =
        selected < 0
          ? event.key === 'ArrowDown'
            ? 0
            : options.length - 1
          : (selected + (event.key === 'ArrowDown' ? 1 : -1) + options.length) %
            options.length;
      options.forEach((option, index) =>
        option.setAttribute('aria-selected', String(index === selected))
      );
      input.setAttribute('aria-activedescendant', options[selected].id);
      options[selected].scrollIntoView({ block: 'nearest' });
    }
  });
}

const editor = document.querySelector('[data-location-editor]');
if (editor) mountEditor(editor);
