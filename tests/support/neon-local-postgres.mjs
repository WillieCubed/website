import process from 'node:process';
import pg from 'pg';

const connectionString = process.env.INDIEWEB_TEST_POSTGRES_URL;
if (!connectionString) {
  throw new Error(
    'Set INDIEWEB_TEST_POSTGRES_URL for the local IndieWeb write tests.'
  );
}

const pool = new pg.Pool({ connectionString, max: 2 });
const originalFetch = globalThis.fetch;
const rawText = { getTypeParser: () => (value) => value };

// @vercel/postgres uses Neon's HTTP wire format. Keep application queries in
// an isolated local database while the production routes run unchanged.
globalThis.fetch = async (input, options) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('https://api.') || !url.endsWith('.neon.tech/sql')) {
    return originalFetch(input, options);
  }

  const { query, params } = JSON.parse(options.body);
  try {
    const result = await pool.query({
      text: query,
      values: params,
      rowMode: 'array',
      types: rawText,
    });
    return globalThis.Response.json({
      fields: result.fields.map(({ name, dataTypeID }) => ({
        name,
        dataTypeID,
      })),
      rows: result.rows,
      rowCount: result.rowCount,
    });
  } catch (error) {
    return globalThis.Response.json(
      { message: error.message, code: error.code },
      { status: 400 }
    );
  }
};
