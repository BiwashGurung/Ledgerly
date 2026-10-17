import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, type LedgerState } from './types';
import { decryptPackage, encryptPackage, makePackage, mergeState, validatePackage } from './transfer';

describe('Ledgerly backup and transfer', () => {
  it('round-trips an encrypted portable snapshot with its passphrase', async () => {
    const state: LedgerState = { ...DEFAULT_STATE, transactions: [{ id: 't1', description: 'Test record', type: 'expense', amountMinor: 1234, category: 'Food and Dining', date: '2026-10-01', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' }] };
    const encrypted = await encryptPackage(makePackage(state), 'correct-horse-battery');
    const restored = await decryptPackage(encrypted, 'correct-horse-battery');
    expect(restored.state.transactions[0].amountMinor).toBe(1234);
    expect(restored.state.profile.lockEnabled).toBe(false);
  });
  it('rejects an incorrect transfer passphrase without returning data', async () => {
    const encrypted = await encryptPackage(makePackage(DEFAULT_STATE), 'correct-horse-battery');
    await expect(decryptPackage(encrypted, 'wrong-passphrase')).rejects.toThrow('Could not decrypt');
  });
  it('validates schema before accepting a backup', () => {
    expect(() => validatePackage({ app: 'Ledgerly', version: 77 })).toThrow('not supported');
    expect(validatePackage(makePackage(DEFAULT_STATE)).state.transactions).toEqual([]);
  });
  it('merges by stable IDs and keeps current values on conflicts', () => {
    const existing: LedgerState = { ...DEFAULT_STATE, transactions: [{ id: 'same', description: 'Keep me', type: 'income', amountMinor: 1000, category: 'Salary', date: '2026-10-01', createdAt: '', updatedAt: '' }] };
    const incoming: LedgerState = { ...DEFAULT_STATE, transactions: [existing.transactions[0], { ...existing.transactions[0], id: 'new', description: 'Add me' }] };
    const merged = mergeState(existing, incoming);
    expect(merged.transactions.map(t => t.description)).toEqual(['Keep me', 'Add me']);
  });
});
