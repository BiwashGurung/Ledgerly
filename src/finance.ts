import type { Budget, Currency, Goal, LedgerState, Transaction } from './types';

export const digitsFor = (currency: Currency) => new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
export const toMinor = (amount: string | number, currency: Currency) => {
  const parsed = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('Enter an amount greater than zero.');
  return Math.round(parsed * (10 ** digitsFor(currency)));
};
export const fromMinor = (amountMinor: number, currency: Currency) => amountMinor / (10 ** digitsFor(currency));
export const money = (amountMinor: number, currency: Currency, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(undefined, { style: 'currency', currency, ...opts }).format(fromMinor(amountMinor, currency));
export const monthKey = (date: string | Date) => { const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T12:00:00`) : date; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export const validTransaction = (t: Transaction) => !!t.id && !!t.description.trim() && Number.isSafeInteger(t.amountMinor) && t.amountMinor > 0 && (t.type === 'income' || t.type === 'expense') && /^\d{4}-\d{2}-\d{2}$/.test(t.date);
export const safeTransactions = (items: Transaction[]) => items.filter(validTransaction);
export const totals = (transactions: Transaction[], month?: string) => safeTransactions(transactions).reduce((sum, t) => {
  if (month && monthKey(t.date) !== month) return sum;
  if (t.type === 'income') sum.income += t.amountMinor; else sum.expenses += t.amountMinor;
  return sum;
}, { income: 0, expenses: 0 });
export const lifetimeBalance = (transactions: Transaction[]) => { const { income, expenses } = totals(transactions); return income - expenses; };
export const categorySpending = (transactions: Transaction[], category: string, month: string) => safeTransactions(transactions).filter(t => t.type === 'expense' && t.category === category && monthKey(t.date) === month).reduce((sum, t) => sum + t.amountMinor, 0);
export function budgetAllowance(budget: Budget, budgets: Budget[], transactions: Transaction[]) {
  let carry = 0;
  if (budget.rollover) {
    const previous = new Date(`${budget.month}-01T12:00:00`); previous.setMonth(previous.getMonth() - 1);
    const previousKey = monthKey(previous);
    const prior = budgets.find(b => b.category === budget.category && b.month === previousKey && b.rollover);
    if (prior) carry = Math.max(0, budgetAllowance(prior, budgets, transactions).remainingMinor);
  }
  const spent = budget.category === 'All categories'
    ? totals(transactions.filter(t => t.type === 'expense' && monthKey(t.date) === budget.month), budget.month).expenses
    : categorySpending(transactions, budget.category, budget.month);
  return { baseMinor: budget.limitMinor, carryMinor: carry, allowanceMinor: budget.limitMinor + carry, spentMinor: spent, remainingMinor: budget.limitMinor + carry - spent, percent: budget.limitMinor + carry > 0 ? spent / (budget.limitMinor + carry) * 100 : 0 };
}
export const goalBalance = (goal: Goal) => goal.contributions.reduce((sum, c) => sum + (c.type === 'deposit' ? c.amountMinor : -c.amountMinor), 0);
export const monthRange = (month: string) => { const [y, m] = month.split('-').map(Number); return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0), days: new Date(y, m, 0).getDate() }; };
export const monthLabel = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
export const changeMonth = (month: string, by: number) => { const [y, m] = month.split('-').map(Number); return monthKey(new Date(y, m - 1 + by, 1)); };
export const forecast = (budget: Budget, budgets: Budget[], transactions: Transaction[], now = new Date()) => {
  const current = budgetAllowance(budget, budgets, transactions); if (budget.month !== monthKey(now)) return null;
  const day = now.getDate(); if (day < 3) return null;
  const relevant = transactions.filter(t => t.type === 'expense' && monthKey(t.date) === budget.month && (budget.category === 'All categories' || t.category === budget.category));
  if (relevant.length < 2 || current.spentMinor <= 0) return null;
  const projectedMinor = Math.round(current.spentMinor / day * monthRange(budget.month).days);
  return { ...current, projectedMinor, projectedRemainingMinor: current.allowanceMinor - projectedMinor };
};
export const monthSummary = (state: LedgerState, month: string) => totals(state.transactions, month);
