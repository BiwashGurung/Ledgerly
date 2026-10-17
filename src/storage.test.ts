import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_STATE, type LedgerState } from './types';
import { clearAll, disableEncryption, enableEncryption, inspectStorage, loadPlain, lockMemory, saveState, unlock } from './storage';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

const protectedState: LedgerState = { ...DEFAULT_STATE, transactions: [{ id: 'private-id', description: 'Private transaction name', type: 'expense', amountMinor: 1200, category: 'Food and Dining', date: '2026-10-01', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' }] };

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true });
  clearAll();
});

describe('encrypted local persistence', () => {
  it('stores only an encrypted envelope and rejects an incorrect PIN', async () => {
    await enableEncryption('12345678', { ...protectedState, profile: { ...protectedState.profile, lockEnabled: true } });
    expect(inspectStorage().locked).toBe(true);
    const raw = localStorage.getItem('ledgerly.data.v1') ?? '';
    expect(raw).not.toContain('Private transaction name');
    expect(raw).toContain('ciphertext');
    lockMemory();
    await expect(unlock('87654321')).rejects.toThrow();
    expect((await unlock('12345678')).transactions[0].description).toBe('Private transaction name');
  });
  it('re-encrypts each save and can return to the plaintext storage mode deliberately', async () => {
    await enableEncryption('12345678', { ...protectedState, profile: { ...protectedState.profile, lockEnabled: true } });
    const before = JSON.parse(localStorage.getItem('ledgerly.data.v1') ?? '{}');
    await saveState({ ...protectedState, transactions: [{ ...protectedState.transactions[0], amountMinor: 3400 }] });
    const after = JSON.parse(localStorage.getItem('ledgerly.data.v1') ?? '{}');
    expect(after.mode).toBe('encrypted');
    expect(after.iv).not.toBe(before.iv);
    const restored = await unlock('12345678');
    disableEncryption({ ...restored, profile: { ...restored.profile, lockEnabled: false } });
    expect(inspectStorage().locked).toBe(false);
    expect(loadPlain().transactions[0].amountMinor).toBe(3400);
  });
});
