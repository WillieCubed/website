import type {
  IndieAuthCodeRecord,
  IndieAuthStore,
  IndieAuthTokenGrant,
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
    {
      record: IndieAuthCodeRecord;
      usedAt: Date | null;
      replayedAt: Date | null;
    }
  >();
  const tokens = new Map<
    string,
    { record: IndieAuthTokenRecord; revokedAt: Date | null }
  >();

  const families = new Map<
    string,
    { grant: IndieAuthTokenGrant; revokedAt: Date | null }
  >();
  const refreshTokens = new Map<
    string,
    { familyId: string; expiresAt: Date; usedAt: Date | null }
  >();

  const store: IndieAuthStore = {
    async saveCode(codeHash, record) {
      codes.set(codeHash, { record, usedAt: null, replayedAt: null });
    },
    async consumeCode(codeHash, now) {
      const row = codes.get(codeHash);
      if (!row) return null;
      if (row.usedAt) {
        row.replayedAt = now;
        for (const family of families.values()) {
          if (family.grant.authorizationCodeHash === codeHash)
            family.revokedAt = now;
        }
        return null;
      }
      if (row.record.expiresAt <= now) return null;
      row.usedAt = now;
      return row.record;
    },
    async saveToken(tokenHash, record) {
      tokens.set(tokenHash, { record, revokedAt: null });
    },
    async saveTokenGrant(tokenHash, grant) {
      if (grant.authorizationCodeHash) {
        const code = codes.get(grant.authorizationCodeHash);
        if (
          !code?.usedAt ||
          code.replayedAt ||
          code.record.clientId !== grant.clientId ||
          code.record.me !== grant.me ||
          code.record.scope.join(' ') !== grant.scope.join(' ') ||
          [...families.values()].some(
            (family) =>
              family.grant.authorizationCodeHash === grant.authorizationCodeHash
          )
        )
          return false;
      }
      families.set(grant.refreshFamilyId, { grant, revokedAt: null });
      refreshTokens.set(grant.refreshTokenHash, {
        familyId: grant.refreshFamilyId,
        expiresAt: grant.refreshExpiresAt,
        usedAt: null,
      });
      tokens.set(tokenHash, { record: grant, revokedAt: null });
      return true;
    },
    async rotateRefreshToken(rotation) {
      const row = refreshTokens.get(rotation.refreshTokenHash);
      const family = row && families.get(row.familyId);
      if (
        !row ||
        !family ||
        family.revokedAt ||
        family.grant.clientId !== rotation.clientId
      ) {
        return { ok: false, error: 'invalid_grant' };
      }
      if (row.usedAt) {
        family.revokedAt = rotation.now;
        return { ok: false, error: 'invalid_grant' };
      }
      if (row.expiresAt <= rotation.now)
        return { ok: false, error: 'invalid_grant' };
      const scope = rotation.scope ?? family.grant.scope;
      if (
        scope.length === 0 ||
        scope.some((s) => !family.grant.scope.includes(s)) ||
        (scope.includes('email') && !scope.includes('profile'))
      ) {
        return { ok: false, error: 'invalid_scope' };
      }
      row.usedAt = rotation.now;
      refreshTokens.set(rotation.nextRefreshTokenHash, {
        familyId: row.familyId,
        expiresAt: rotation.refreshExpiresAt,
        usedAt: null,
      });
      const record: IndieAuthTokenRecord = {
        clientId: family.grant.clientId,
        me: family.grant.me,
        scope,
        issuedAt: rotation.now,
        expiresAt: rotation.accessExpiresAt,
        refreshFamilyId: row.familyId,
      };
      tokens.set(rotation.accessTokenHash, { record, revokedAt: null });
      return { ok: true, record };
    },
    async findToken(tokenHash, now) {
      const row = tokens.get(tokenHash);
      if (!row || row.revokedAt || row.record.expiresAt <= now) return null;
      if (
        row.record.refreshFamilyId &&
        families.get(row.record.refreshFamilyId)?.revokedAt
      )
        return null;
      return row.record;
    },
    async revokeToken(tokenHash, now) {
      const row = tokens.get(tokenHash);
      if (row && !row.revokedAt) row.revokedAt = now;
      const refresh = refreshTokens.get(tokenHash);
      const family = refresh && families.get(refresh.familyId);
      if (family && !family.revokedAt) family.revokedAt = now;
    },
  };

  return { store, codes, tokens, families, refreshTokens };
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
