import { sql } from '@vercel/postgres';

import { createStatusStore } from './store';

export const statusStore = createStatusStore((text, values) =>
  sql.query(text, values)
);
