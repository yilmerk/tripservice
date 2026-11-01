import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import type { Trip } from '../types/trip';
import { currencies, expenseCategories, type Currency, type Expense, type ExpenseInput } from '../types/expense';
import { addExpense, deleteExpense, ensureExpenseLedger, setTripBudget, subscribeExpenses, updateExpense } from '../services/expenseService';
import { digits, expenseSummary, formatMoney } from '../utils/money';
import { Modal } from './TripForms';
import './expenses.css';

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') return 'Harcamalara erişilemiyor. Yeni firestore.rules kurallarını Firebase Console üzerinden yayınlayın.';
  return error instanceof Error ? error.message : 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
}
function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function CurrencyOptions() { return <>{currencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}</>; }
function ExpenseForm({ baseCurrency, expense, onSave, busy }: { baseCurrency: Currency; expense?: Expense; onSave: (input: ExpenseInput) => Promise<void>; busy: boolean }) {
  const [currency, setCurrency] = useState<Currency>(expense?.currency ?? baseCurrency);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setError('');
    const data = new FormData(event.currentTarget);
    try {
      await onSave({ name: String(data.get('name')).trim(), amount: Number(data.get('amount')), currency, date: String(data.get('date')), category: String(data.get('category')) as ExpenseInput['category'], exchangeRate: currency === baseCurrency ? 1 : Number(data.get('rate')) });
    } catch (err) { setError(errorMessage(err)); }
  }
  return <form className="planner-form" onSubmit={submit}><fieldset disabled={busy}>
    <label>Harcama adı<input autoFocus required name="name" maxLength={150} defaultValue={expense?.name} placeholder="Örn. Akşam yemeği"/></label>
    <div className="field-row"><label>Tutar<input required name="amount" type="number" min={digits(currency) === 0 ? '1' : '0.01'} step={digits(currency) === 0 ? '1' : '0.01'} defaultValue={expense ? expense.amountMinor / 10 ** digits(expense.currency) : undefined}/></label><label>Para birimi<select value={currency} onChange={event => setCurrency(event.target.value as Currency)}><CurrencyOptions/></select></label></div>
    {currency !== baseCurrency && <label>Dönüşüm kuru: 1 {currency} kaç {baseCurrency}?<input required type="number" name="rate" step="any" min="0.000000001" defaultValue={expense?.currency === currency ? expense.exchangeRate : undefined}/><span className="field-hint">Kayıt tarihindeki kuru girin. Kur otomatik alınmaz.</span></label>}
    <div className="field-row"><label>Tarih<input required type="date" name="date" defaultValue={expense?.date ?? localToday()}/></label><label>Harcama kategorisi<select name="category" defaultValue={expense?.category ?? 'food'}>{Object.entries(expenseCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
    {error && <p className="error-message" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Kaydediliyor…' : expense ? 'Harcamayı güncelle' : 'Harcamayı kaydet'}</button>
  </fieldset></form>;
}
export default function ExpensePanel({ userId, trip }: { userId: string; trip: Trip }) {
  const currency = trip.currency ?? 'EUR';
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(Boolean(trip.budgetCurrencyLocked));
  const [editor, setEditor] = useState<'budget' | 'expense' | Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  useEffect(() => {
    let active = true; let unsubscribe: (() => void) | undefined;
    setLoading(true); setLoadError('');
    void ensureExpenseLedger(userId, trip.id).then(ledger => {
      if (!active) return;
      setLocked(ledger.hasExpenses);
      unsubscribe = subscribeExpenses(userId, trip.id, data => { if (active) { setExpenses(data); setLoading(false); if (data.length) setLocked(true); } }, err => { if (active) { setLoadError(errorMessage(err)); setLoading(false); } });
    }).catch(err => { if (active) { setLoadError(errorMessage(err)); setLoading(false); } });
    return () => { active = false; unsubscribe?.(); };
  }, [userId, trip.id, retry]);
  async function save(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); setEditor(null); } catch (err) { throw new Error(errorMessage(err)); } finally { setBusy(false); }
  }
  let summary: ReturnType<typeof expenseSummary> | undefined;
  let summaryError = '';
  try { summary = expenseSummary(expenses, trip.totalBudget, currency); } catch (err) { summaryError = errorMessage(err); }
  const ready = !loading && !loadError && !summaryError;
  return <section className="expense-panel" aria-label="Seyahat bütçesi"><div className="section-heading"><div><span className="form-kicker">{trip.title} · {currency}</span><h2><Wallet size={22}/> Bütçe ve harcamalar</h2></div><div className="expense-actions"><button className="outline-button" disabled={loading || busy || Boolean(loadError)} onClick={() => setEditor('budget')}><Pencil size={14}/>Bütçeyi düzenle</button><button className="solid-button" disabled={!ready || busy} onClick={() => setEditor('expense')}><Plus size={15}/>Harcama ekle</button></div></div>
    {loading ? <p role="status">Harcamalar yükleniyor…</p> : loadError ? <div role="alert"><p className="error-message">{loadError}</p><button className="outline-button" onClick={() => setRetry(value => value + 1)}>Harcamaları tekrar yükle</button></div> : summaryError ? <p className="error-message" role="alert">{summaryError}</p> : summary && <>
    <div className="budget-cards"><article><span>Toplam Bütçe</span><strong>{summary.budgetMinor === undefined ? 'Belirlenmedi' : formatMoney(summary.budgetMinor, currency)}</strong></article><article><span>Harcanan Tutar</span><strong>{formatMoney(summary.spent, currency)}</strong></article><article className={summary.overBudget ? 'budget-exceeded' : ''}><span>Kalan Bütçe</span><strong>{summary.remaining === undefined ? '—' : formatMoney(summary.remaining, currency)}</strong></article></div>
    {summary.budgetMinor !== undefined ? <div className={`budget-progress ${summary.overBudget ? 'danger' : summary.percent > 80 ? 'warning' : ''}`}><div className="progress-caption"><span>{summary.overBudget ? 'Bütçe aşıldı' : summary.percent > 80 ? 'Bütçenin %80’inden fazlası kullanıldı' : 'Bütçe kullanımı'}</span><strong>%{summary.percent.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}</strong></div><div className="progress-track" role="progressbar" aria-label="Bütçe doluluk oranı" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, summary.percent)} aria-valuetext={summary.overBudget ? `Bütçe aşıldı, ${formatMoney(summary.spent, currency)} harcandı` : `%${summary.percent.toFixed(1)}`}><span style={{ width: `${Math.min(100, summary.percent)}%` }}/></div></div> : <p className="field-hint">Hedef bütçeni belirleyerek kalan tutarı ve doluluk oranını takip et.</p>}
    <div className="expense-columns"><section><h3>Kategori dağılımı</h3><ul className="category-distribution">{Object.entries(expenseCategories).map(([key, label]) => <li key={key}><div><span>{label}</span><strong>{formatMoney(summary.categories[key as ExpenseInput['category']], currency)}</strong></div><div className="category-track"><span style={{ width: `${summary.spent ? summary.categories[key as ExpenseInput['category']] / summary.spent * 100 : 0}%` }}/></div></li>)}</ul></section><section><h3>Harcama geçmişi <span>({expenses.length})</span></h3>{!expenses.length ? <p className="expense-empty">Henüz harcama yok. İlk harcamanı ekle.</p> : <ul className="expense-list">{expenses.map(expense => <li key={expense.id}><div><strong>{expense.name}</strong><span>{expense.date} · {expenseCategories[expense.category]}</span>{expense.currency !== currency && <small>{formatMoney(expense.amountMinor, expense.currency)} × {expense.exchangeRate}</small>}</div><div className="expense-amount"><strong>{formatMoney(expense.baseAmountMinor, currency)}</strong><div><button className="icon-button" aria-label={`${expense.name}: harcamayı düzenle`} disabled={busy} onClick={() => setEditor(expense)}><Pencil size={14}/></button><button className="icon-button" aria-label={`${expense.name}: harcamayı sil`} disabled={busy} onClick={() => setDeleting(expense)}><Trash2 size={14}/></button></div></div></li>)}</ul>}</section></div>
    </>}{error && <p className="error-message" role="alert">{error}</p>}
    {editor && <Modal busy={busy} title={editor === 'budget' ? 'Seyahat bütçesi' : editor === 'expense' ? 'Yeni harcama' : 'Harcamayı düzenle'} onClose={() => setEditor(null)}>{editor === 'budget' ? <BudgetForm trip={trip} locked={locked || Boolean(trip.budgetCurrencyLocked)} busy={busy} onSave={(budget, selectedCurrency) => save(() => setTripBudget(userId, trip.id, budget, selectedCurrency))}/> : <ExpenseForm expense={typeof editor === 'object' ? editor : undefined} baseCurrency={currency} busy={busy} onSave={input => save(async () => { if (typeof editor === 'object') await updateExpense(userId, trip.id, editor.id, input); else await addExpense(userId, trip.id, input); })}/>}</Modal>}
    {deleting && <Modal busy={busy} title="Harcamayı sil" onClose={() => setDeleting(null)}><p>“{deleting.name}” harcaması silinsin mi?</p><button className="outline-button" disabled={busy} onClick={() => setDeleting(null)}>Vazgeç</button><button className="solid-button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await deleteExpense(userId, trip.id, deleting.id); setDeleting(null); } catch (err) { setError(errorMessage(err)); setDeleting(null); } finally { setBusy(false); } }}>{busy ? 'Siliniyor…' : 'Harcamayı sil'}</button></Modal>}
  </section>;
}
function BudgetForm({ trip, locked, busy, onSave }: { trip: Trip; locked: boolean; busy: boolean; onSave: (budget: number, currency: Currency) => Promise<void> }) {
  const [currency, setCurrency] = useState<Currency>(trip.currency ?? 'EUR');
  const [error, setError] = useState('');
  return <form className="planner-form" onSubmit={async event => { event.preventDefault(); if (busy) return; const data = new FormData(event.currentTarget); setError(''); try { await onSave(Number(data.get('budget')), currency); } catch (err) { setError(errorMessage(err)); } }}><fieldset disabled={busy}><label>Hedef bütçe<input autoFocus required name="budget" type="number" min="0" step={digits(currency) === 0 ? '1' : '0.01'} defaultValue={trip.totalBudget}/></label><label>Varsayılan para birimi<select value={currency} disabled={locked} onChange={event => setCurrency(event.target.value as Currency)}><CurrencyOptions/></select></label><p className="field-hint">İlk harcamadan sonra ana para birimi sabitlenir. Diğer para birimlerini harcama formunda kur girerek kullanabilirsin.</p>{error && <p className="error-message" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Bütçeyi kaydet'}</button></fieldset></form>;
}
