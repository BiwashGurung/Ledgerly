export type TxType = 'income' | 'expense';
export type Currency = 'NPR' | 'USD' | 'GBP' | 'EUR' | 'INR' | 'AUD';
export interface Transaction { id: string; description: string; type: TxType; amountMinor: number; category: string; date: string; paymentMethod?: string; notes?: string; createdAt: string; updatedAt: string; }
export interface Budget { id: string; month: string; category: string; limitMinor: number; rollover: boolean; }
export interface Contribution { id: string; date: string; amountMinor: number; type: 'deposit' | 'withdrawal'; note?: string; }
export interface Goal { id: string; title: string; targetMinor: number; deadline?: string; icon?: string; archived?: boolean; contributions: Contribution[]; }
export interface Reminder { id: string; title: string; dueDate: string; time: string; description?: string; category?: string; amountMinor?: number; recurrence: 'none' | 'monthly' | 'yearly'; status: 'upcoming' | 'done'; snoozedUntil?: string; createdAt: string; }
export interface Challenge { id: string; title: string; description?: string; startDate: string; endDate: string; categories: string[]; keywords: string[]; capMinor?: number; }
export interface Profile { name: string; currency: Currency; reminderTime: string; lockEnabled: boolean; autoLockMinutes: number; notificationsEnabled: boolean; }
export interface LedgerState { schemaVersion: 1; transactions: Transaction[]; budgets: Budget[]; goals: Goal[]; reminders: Reminder[]; challenges: Challenge[]; profile: Profile; }
export const DEFAULT_STATE: LedgerState = { schemaVersion: 1, transactions: [], budgets: [], goals: [], reminders: [], challenges: [], profile: { name: '', currency: 'NPR', reminderTime: '09:00', lockEnabled: false, autoLockMinutes: 10, notificationsEnabled: false } };
export const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Business', 'Investments', 'Gifts', 'Other Income'];
export const EXPENSE_CATEGORIES = ['Food and Dining', 'Transport', 'Shopping', 'Housing and Rent', 'Bills and Utilities', 'Health', 'Education', 'Entertainment', 'Subscriptions', 'Travel', 'Personal Care', 'Other Expenses'];
export const CURRENCIES: Currency[] = ['NPR', 'USD', 'GBP', 'EUR', 'INR', 'AUD'];
export const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
