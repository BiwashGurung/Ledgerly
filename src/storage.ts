import { CURRENCIES, DEFAULT_STATE, type LedgerState } from './types';

const DATA_KEY = 'ledgerly.data.v1';
const TEMP_KEY = 'ledgerly.data.pending';
type PlainEnvelope = { version: 1; mode: 'plain'; state: LedgerState };
type EncryptedEnvelope = { version: 1; mode: 'encrypted'; salt: string; iv: string; ciphertext: string; iterations: number };
type Envelope = PlainEnvelope | EncryptedEnvelope;
let encryption: EncryptedEnvelope | null = null;
let unlockedKey: CryptoKey | null = null;
const encode = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const decode = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const derive = async (pin: string, salt: Uint8Array, iterations: number) => {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt.slice().buffer as ArrayBuffer, iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
const validMinor = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0;
const safeState = (candidate: unknown): LedgerState => {
  if (!candidate || typeof candidate !== 'object') throw new Error('The data package is not valid.');
  const raw = candidate as Partial<LedgerState>;
  if (![raw.transactions, raw.budgets, raw.goals, raw.reminders, raw.challenges].every(Array.isArray)) throw new Error('The saved Ledgerly data is incomplete. Restore a backup instead of overwriting it.');
  const transactions = raw.transactions as LedgerState['transactions']; const budgets = raw.budgets as LedgerState['budgets']; const goals = raw.goals as LedgerState['goals']; const reminders = raw.reminders as LedgerState['reminders']; const challenges = raw.challenges as LedgerState['challenges'];
  if (transactions.some(t => !t?.id || !t.description?.trim() || !validMinor(t.amountMinor) || !validDate(t.date) || !['income', 'expense'].includes(t.type) || typeof t.category !== 'string')) throw new Error('A saved transaction is invalid. Restore a backup instead of overwriting it.');
  if (budgets.some(b => !b?.id || !/^\d{4}-\d{2}$/.test(b.month) || !b.category || !validMinor(b.limitMinor) || typeof b.rollover !== 'boolean')) throw new Error('A saved budget is invalid. Restore a backup instead of overwriting it.');
  if (goals.some(g => !g?.id || !g.title?.trim() || !validMinor(g.targetMinor) || !Array.isArray(g.contributions) || g.contributions.some(c => !c?.id || !validDate(c.date) || !validMinor(c.amountMinor) || !['deposit', 'withdrawal'].includes(c.type)))) throw new Error('A saved savings goal is invalid. Restore a backup instead of overwriting it.');
  if (reminders.some(r => !r?.id || !r.title?.trim() || !validDate(r.dueDate) || !/^\d{2}:\d{2}$/.test(r.time) || !['none', 'monthly', 'yearly'].includes(r.recurrence) || !['upcoming', 'done'].includes(r.status) || (r.amountMinor !== undefined && !validMinor(r.amountMinor)))) throw new Error('A saved reminder is invalid. Restore a backup instead of overwriting it.');
  if (challenges.some(c => !c?.id || !c.title?.trim() || !validDate(c.startDate) || !validDate(c.endDate) || c.endDate < c.startDate || !Array.isArray(c.categories) || !Array.isArray(c.keywords) || (c.capMinor !== undefined && !validMinor(c.capMinor)))) throw new Error('A saved challenge is invalid. Restore a backup instead of overwriting it.');
  const profile = { ...DEFAULT_STATE.profile, ...(raw.profile ?? {}) };
  if (!CURRENCIES.includes(profile.currency) || typeof profile.name !== 'string' || !/^\d{2}:\d{2}$/.test(profile.reminderTime) || !Number.isFinite(profile.autoLockMinutes) || typeof profile.notificationsEnabled !== 'boolean') throw new Error('The saved Ledgerly profile is invalid. Restore a backup instead of overwriting it.');
  return { schemaVersion: 1, transactions, budgets, goals, reminders, challenges, profile };
};
const commit = (envelope: Envelope) => {
  const json = JSON.stringify(envelope);
  localStorage.setItem(TEMP_KEY, json);
  JSON.parse(localStorage.getItem(TEMP_KEY) ?? 'null');
  localStorage.setItem(DATA_KEY, json);
  localStorage.removeItem(TEMP_KEY);
};
export function inspectStorage() {
  try { const raw = localStorage.getItem(DATA_KEY); if (!raw) return { exists: false, locked: false };
    const env = JSON.parse(raw) as Envelope;
    if (env.version !== 1 || !['plain', 'encrypted'].includes(env.mode)) return { exists: true, locked: false, error: true };
    if (env.mode === 'plain') safeState(env.state);
    else if (!env.salt || !env.iv || !env.ciphertext || !Number.isSafeInteger(env.iterations)) return { exists: true, locked: true, error: true };
    encryption = env.mode === 'encrypted' ? env : null;
    return { exists: true, locked: env.mode === 'encrypted' };
  } catch { return { exists: false, locked: false, error: true }; }
}
export function loadPlain(): LedgerState {
  try { const raw = localStorage.getItem(DATA_KEY); if (!raw) return DEFAULT_STATE;
    const env = JSON.parse(raw) as Envelope; if (env.mode === 'encrypted') { encryption = env; return DEFAULT_STATE; }
    return safeState(env.state);
  } catch { return DEFAULT_STATE; }
}
export async function unlock(pin: string): Promise<LedgerState> {
  if (!encryption) { const raw = localStorage.getItem(DATA_KEY); if (!raw) throw new Error('No protected data found.'); const env = JSON.parse(raw) as EncryptedEnvelope; encryption = env; }
  const env = encryption; if (!env) throw new Error('No protected data found.');
  const key = await derive(pin, decode(env.salt), env.iterations);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(env.iv).slice().buffer as ArrayBuffer }, key, decode(env.ciphertext).slice().buffer as ArrayBuffer);
  const state = safeState(JSON.parse(new TextDecoder().decode(plaintext))); unlockedKey = key; return state;
}
export async function saveState(state: LedgerState) {
  if (!encryption) { commit({ version: 1, mode: 'plain', state }); return; }
  if (!unlockedKey) throw new Error('Unlock Ledgerly before saving.');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.slice().buffer as ArrayBuffer }, unlockedKey, new TextEncoder().encode(JSON.stringify(state)));
  const next: EncryptedEnvelope = { ...encryption, iv: encode(iv.slice().buffer as ArrayBuffer), ciphertext: encode(ciphertext) };
  commit(next); encryption = next;
}
export async function enableEncryption(pin: string, state: LedgerState) {
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iterations = 310_000; const key = await derive(pin, salt, iterations);
  const iv = crypto.getRandomValues(new Uint8Array(12)); const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.slice().buffer as ArrayBuffer }, key, new TextEncoder().encode(JSON.stringify(state)));
  const envelope: EncryptedEnvelope = { version: 1, mode: 'encrypted', salt: encode(salt.slice().buffer as ArrayBuffer), iv: encode(iv.slice().buffer as ArrayBuffer), ciphertext: encode(ciphertext), iterations };
  commit(envelope); encryption = envelope; unlockedKey = key;
}
export function disableEncryption(state: LedgerState) { commit({ version: 1, mode: 'plain', state }); encryption = null; unlockedKey = null; }
export async function changePin(pin: string, state: LedgerState) { await enableEncryption(pin, state); }
export function lockMemory() { unlockedKey = null; }
export function clearAll() { localStorage.removeItem(DATA_KEY); localStorage.removeItem(TEMP_KEY); encryption = null; unlockedKey = null; }
export function currentEnvelope() { const raw = localStorage.getItem(DATA_KEY); return raw ? JSON.parse(raw) as Envelope : null; }
