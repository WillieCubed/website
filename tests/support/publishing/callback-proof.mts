import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface CapturedCallback {
  url: string;
  flowCookie: string;
  outcome: 'authorized' | 'rejected';
  visitor: string;
  sessionHash: string;
  stateHash: string;
  issuedStateHash: string;
  issuedStateExpiresAt: number;
  issuedStateIssuer: string;
  expectation: 'grant' | 'cancel' | 'expired';
  status: number;
  location: string;
  sessionReplaced: boolean;
  expirySource?: string;
  wrongBrowserRejected: boolean;
  signature: string;
}

export function callbackSignature(
  proof: Omit<CapturedCallback, 'signature'>,
  storageKey: string
) {
  return createHmac('sha256', Buffer.from(storageKey, 'base64'))
    .update(
      JSON.stringify([
        proof.outcome,
        proof.url,
        proof.flowCookie,
        proof.visitor,
        proof.sessionHash,
        proof.stateHash,
        proof.issuedStateHash,
        proof.issuedStateExpiresAt,
        proof.issuedStateIssuer,
        proof.expectation,
        proof.status,
        proof.location,
        proof.sessionReplaced,
        proof.expirySource ?? '',
        proof.wrongBrowserRejected,
      ])
    )
    .digest('hex');
}

export function verifyCallbackSignature(
  proof: CapturedCallback,
  storageKey: string
) {
  const signature = callbackSignature(proof, storageKey);
  assert(
    typeof proof.signature === 'string' &&
      /^[a-f0-9]{64}$/.test(proof.signature) &&
      timingSafeEqual(Buffer.from(proof.signature), Buffer.from(signature)),
    'The callback proof must come from the actual manual capture companion.'
  );
  assert(/^[a-f0-9]{64}$/.test(proof.flowCookie));
  assert(/^[a-f0-9]{64}$/.test(proof.sessionHash));
  assert(proof.stateHash === proof.issuedStateHash);
  assert(Number.isFinite(proof.issuedStateExpiresAt));
  assert(proof.status === 303);
}
