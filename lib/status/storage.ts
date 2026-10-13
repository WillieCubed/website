import { sql } from '@/lib/db/postgres';

import { createStatusStore } from './store';

export const statusStore = createStatusStore((text, values) =>
  sql.query(text, values)
);
