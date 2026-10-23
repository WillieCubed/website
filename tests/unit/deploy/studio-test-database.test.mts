import assert from 'node:assert/strict';
import test from 'node:test';

import { studioTestDatabase } from '../../support/studio/database.mts';

test('Studio CI preserves the supplied TCP database and scopes only the application connection', () => {
  const source =
    'postgresql://fixture:fixture@127.0.0.1:5432/website_test?options=-c%20application_name%3Dfixture';
  const config = studioTestDatabase('studio_e2e_abc123', source);
  assert.equal(config.admin.connectionString, source);
  const application = new URL(config.applicationUrl);
  assert.equal(application.hostname, '127.0.0.1');
  assert.equal(application.port, '5432');
  assert.equal(application.pathname, '/website_test');
  assert.equal(application.username, 'fixture');
  assert.equal(application.password, 'fixture');
  assert.equal(
    application.searchParams.get('options'),
    '-c application_name=fixture -c search_path=studio_e2e_abc123'
  );
  assert.equal(
    new URL(source).searchParams.get('options'),
    '-c application_name=fixture'
  );
});

test('the existing local Studio fixture still uses the /tmp socket by default', () => {
  const config = studioTestDatabase('studio_e2e_def456');
  assert.equal(config.admin.host, '/tmp');
  assert.equal(config.admin.database, 'postgres');
  const application = new URL(config.applicationUrl);
  assert.equal(application.searchParams.get('host'), '/tmp');
  assert.equal(
    application.searchParams.get('options'),
    '-c search_path=studio_e2e_def456'
  );
});
