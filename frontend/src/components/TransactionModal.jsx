import { useEffect, useState } from "react";
import { accountsApi, cardsApi, transactionsApi } from "../api";

const EXPENSE_CATEGORIES = ["식비", "교통", "주거", "쇼핑", "의료", "여가", "교육", "기타"];
const INCOME_CATEGORIES = ["급여", "용돈", "이자", "환급", "기타"];

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function TransactionModal({ open, onClose, onSaved, initial, defaultDate }) {
  const editing = Boolean(initial?.id);
  const [accounts, setAccounts] = useState([]);
  const [cards, setCards] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    transaction_date: defaultDate || todayStr(),
    category: "",
    description: "",
    account_id: "",
    card_id: "",
  });

  useEffect(() => {
    if (!open) return;
    setError("");
    Promise.all([accountsApi.list(), cardsApi.list()]).then(([a, c]) => {
      setAccounts(a.data);
      setCards(c.data);
    });
    if (initial) {
      setForm({
        type: initial.type ?? "expense",
        amount: initial.amount?.toString() ?? "",
        transaction_date: initial.transaction_date ?? defaultDate ?? todayStr(),
        category: initial.category ?? "",
        description: initial.description ?? "",
        account_id: initial.account_id ?? "",
        card_id: initial.card_id ?? "",
      });
    } else {
      setForm((f) => ({
        ...f,
        type: "expense",
        amount: "",
        category: "",
        description: "",
        account_id: "",
        card_id: "",
        transaction_date: defaultDate || todayStr(),
      }));
    }
  }, [open, initial, defaultDate]);

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.amount || Number(form.amount) < 0) {
      setError("금액을 올바르게 입력하세요.");
      return;
    }
    const payload = {
      type: form.type,
      amount: parseInt(form.amount, 10),
      transaction_date: form.transaction_date,
      category: form.category || null,
      description: form.description || null,
      account_id: form.account_id || null,
      card_id: form.card_id || null,
    };
    setSaving(true);
    try {
      if (editing) {
        await transactionsApi.update(initial.id, payload);
      } else {
        await transactionsApi.create(payload);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const categories = form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">{editing ? "거래 수정" : "거래 추가"}</h2>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 수입/지출 토글 */}
          <div className="grid grid-cols-2 gap-2">
            {["expense", "income"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set("type", t)}
                className={`rounded-lg py-2 text-sm font-semibold ${
                  form.type === t
                    ? t === "income"
                      ? "bg-blue-500 text-white"
                      : "bg-red-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {t === "income" ? "수입" : "지출"}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-600">금액</label>
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="0"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-600">날짜</label>
            <input
              type="date"
              value={form.transaction_date}
              onChange={(e) => set("transaction_date", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-600">카테고리</label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="">선택 안 함</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm text-gray-600">계좌</label>
              <select
                value={form.account_id}
                onChange={(e) => set("account_id", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="">없음</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">카드</label>
              <select
                value={form.card_id}
                onChange={(e) => set("card_id", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="">없음</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-600">메모</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="내용"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-500 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
