/* global document */
const locationForm = document.querySelector('[data-location-form]');

locationForm?.addEventListener('submit', (event) => {
  if (locationForm.dataset.editing === 'true') return;
  event.preventDefault();
  locationForm.dataset.editing = 'true';
  const input = locationForm.querySelector('[data-city-input]');
  input.hidden = false;
  input.disabled = false;
  locationForm.querySelector('[data-city-display]').hidden = true;
  locationForm.querySelector('[data-edit-button]').textContent = 'Search';
  document.querySelector('[data-cancel]').hidden = false;
  input.focus();
  input.select();
});
