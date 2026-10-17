import { CURRENCIES, DEFAULT_STATE, type LedgerState } from './types';

const ITERATIONS = 310_000;
const bytesToBase64 = (data: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(data)));
const base64ToBytes = (data: string) => Uint8Array.from(atob(data), char => char.charCodeAt(0));
const derive = async (passphrase: string, salt: Uint8Array) => {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt.slice().buffer as ArrayBuffer, iterations: ITERATIONS, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};
export type BackupPackage = { app: 'Ledgerly'; version: 1; createdAt: string; state: LedgerState };
export const makePackage = (state: LedgerState): BackupPackage => ({
  app: 'Ledgerly', version: 1, createdAt: new Date().toISOString(),
  state: { ...state, profile: { ...state.profile, lockEnabled: false } },
});
export const validatePackage = (candidate: unknown): BackupPackage => {
  if (!candidate || typeof candidate !== 'object') throw new Error('This file is not a Ledgerly backup.');
  const value = candidate as Partial<BackupPackage>;
  if (value.app !== 'Ledgerly' || value.version !== 1 || !value.state || typeof value.state !== 'object') throw new Error('This Ledgerly backup version is not supported.');
  const state = value.state as Partial<LedgerState>;
  for (const key of ['transactions', 'budgets', 'goals', 'reminders', 'challenges'] as const) if (!Array.isArray(state[key])) throw new Error(`The backup is missing ${key}.`);
  if (!state.profile || typeof state.profile !== 'object') throw new Error('The backup profile is missing.');
  if (!CURRENCIES.includes(state.profile.currency) || typeof state.profile.name !== 'string' || !/^\d{2}:\d{2}$/.test(state.profile.reminderTime) || !Number.isFinite(state.profile.autoLockMinutes) || typeof state.profile.notificationsEnabled !== 'boolean') throw new Error('The backup profile contains invalid preferences.');
  for (const t of state.transactions!) if (!t.id || !Number.isSafeInteger(t.amountMinor) || t.amountMinor <= 0 || !t.description || !t.date || !['income', 'expense'].includes(t.type)) throw new Error('The backup contains an invalid transaction.');
  for (const b of state.budgets!) if (!b.id || !Number.isSafeInteger(b.limitMinor) || b.limitMinor <= 0 || !/^\d{4}-\d{2}$/.test(b.month) || !b.category || typeof b.rollover !== 'boolean') throw new Error('The backup contains an invalid budget.');
  for (const goal of state.goals!) if (!goal.id || !goal.title?.trim() || !Number.isSafeInteger(goal.targetMinor) || goal.targetMinor <= 0 || !Array.isArray(goal.contributions) || goal.contributions.some(c => !c.id || !/^\d{4}-\d{2}-\d{2}$/.test(c.date) || !Number.isSafeInteger(c.amountMinor) || c.amountMinor <= 0 || !['deposit', 'withdrawal'].includes(c.type))) throw new Error('The backup contains an invalid savings goal.');
  for (const reminder of state.reminders!) if (!reminder.id || !reminder.title?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(reminder.dueDate) || !/^\d{2}:\d{2}$/.test(reminder.time) || !['none', 'monthly', 'yearly'].includes(reminder.recurrence) || !['upcoming', 'done'].includes(reminder.status) || (reminder.amountMinor !== undefined && (!Number.isSafeInteger(reminder.amountMinor) || reminder.amountMinor <= 0))) throw new Error('The backup contains an invalid reminder.');
  for (const challenge of state.challenges!) if (!challenge.id || !challenge.title?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(challenge.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(challenge.endDate) || challenge.endDate < challenge.startDate || !Array.isArray(challenge.categories) || !Array.isArray(challenge.keywords) || (challenge.capMinor !== undefined && (!Number.isSafeInteger(challenge.capMinor) || challenge.capMinor <= 0))) throw new Error('The backup contains an invalid challenge.');
  return { app: 'Ledgerly', version: 1, createdAt: value.createdAt ?? new Date().toISOString(), state: { ...DEFAULT_STATE, ...state, profile: { ...DEFAULT_STATE.profile, ...state.profile, lockEnabled: false } } };
};
export async function encryptPackage(data: BackupPackage, passphrase: string) {
  if (passphrase.length < 8) throw new Error('Use a transfer passphrase with at least 8 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12)); const key = await derive(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.slice().buffer as ArrayBuffer }, key, new TextEncoder().encode(JSON.stringify(data)));
  return { app: 'Ledgerly encrypted transfer', version: 1, kdf: 'PBKDF2-SHA-256', iterations: ITERATIONS, salt: bytesToBase64(salt.slice().buffer as ArrayBuffer), iv: bytesToBase64(iv.slice().buffer as ArrayBuffer), ciphertext: bytesToBase64(ciphertext) };
}
export async function decryptPackage(candidate: unknown, passphrase: string): Promise<BackupPackage> {
  if (!candidate || typeof candidate !== 'object') throw new Error('This file is not a Ledgerly transfer package.');
  const value = candidate as Record<string, unknown>;
  if (value.app !== 'Ledgerly encrypted transfer' || value.version !== 1 || typeof value.salt !== 'string' || typeof value.iv !== 'string' || typeof value.ciphertext !== 'string') throw new Error('This encrypted transfer package is not supported.');
  try {
    const key = await derive(passphrase, base64ToBytes(value.salt));
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(value.iv).slice().buffer as ArrayBuffer }, key, base64ToBytes(value.ciphertext).slice().buffer as ArrayBuffer);
    return validatePackage(JSON.parse(new TextDecoder().decode(plaintext)));
  } catch { throw new Error('Could not decrypt this transfer. Check the passphrase and file.'); }
}
export function mergeState(existing: LedgerState, incoming: LedgerState): LedgerState {
  const mergeById = <T extends { id: string }>(a: T[], b: T[]) => { const ids = new Set(a.map(item => item.id)); return [...a, ...b.filter(item => !ids.has(item.id))]; };
  return { ...existing,
    transactions: mergeById(existing.transactions, incoming.transactions), budgets: mergeById(existing.budgets, incoming.budgets),
    goals: mergeById(existing.goals, incoming.goals), reminders: mergeById(existing.reminders, incoming.reminders), challenges: mergeById(existing.challenges, incoming.challenges),
  };
}
export function downloadFile(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
