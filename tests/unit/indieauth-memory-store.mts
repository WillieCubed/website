import type {
  IndieAuthCodeRecord,
  IndieAuthStore,
  IndieAuthTokenRecord,
  OwnerSignInStore,
} from '@/lib/indieweb/types';

/**
 * In-memory IndieAuth stores with the same rules as the Postgres ones in
 * `lib/indieweb/indieauth-storage.ts`, for the IndieAuth tests.
 */
export function memoryIndieAuthStore() {
  const codes = new Map<
    string,
    { record: IndieAuthCodeRecord; usedAt: Date | null }
  >();
  const tokens = new Map<
    string,
    { record: IndieAuthTokenRecord; revokedAt: Date | null }
  >();

  const store: IndieAuthStore = {
    async saveCode(codeHash, record) {
      codes.set(codeHash, { record, usedAt: null });
    },
    async consumeCode(codeHash, now) {
      const row = codes.get(codeHash);
      if (!row || row.usedAt || row.record.expiresAt <= now) return null;
      row.usedAt = now;
      return row.record;
    },
    async saveToken(tokenHash, record) {
      tokens.set(tokenHash, { record, revokedAt: null });
    },
    async findToken(tokenHash, now) {
      const row = tokens.get(tokenHash);
      if (!row || row.revokedAt || row.record.expiresAt <= now) return null;
      return row.record;
    },
    async revokeToken(tokenHash, now) {
      const row = tokens.get(tokenHash);
      if (row && !row.revokedAt) row.revokedAt = now;
    },
  };

  return { store, codes, tokens };
}

export function memoryOwnerSignInStore() {
  const failures = new Map<string, Date>();
  let nextId = 1;
  let lastStep = -Infinity;

  const store: OwnerSignInStore = {
    async recordAttempt(windowMs, now) {
      const id = String(nextId++);
      failures.set(id, now);
      // Postgres runs the insert and the count as two queries, so let other
      // requests run between them here too.
      await Promise.resolve();
      let attempts = 0;
      for (const failedAt of failures.values()) {
        if (failedAt.getTime() > now.getTime() - windowMs) attempts++;
      }
      return { id, attempts };
    },
    async forgetAttempt(id) {
      failures.delete(id);
    },
    async claimTotpStep(step) {
      if (step <= lastStep) return false;
      lastStep = step;
      return true;
    },
  };

  return { store, failures };
}
