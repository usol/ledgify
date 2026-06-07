import { useEffect, useState } from "react";
import { accountsApi, cardsApi, categoriesApi, transactionsApi } from "../api";

const todayStr = () => new Date().toISOString().slice(0, 10);

// 거래의 계좌/카드 값을 단일 결제수단 select 값으로 변환
// "card:<id>" | "account:<id>" | "cash"(지출, 둘 다 없음) | ""(수입, 둘 다 없음)
const derivePayment = (tx) => {
  if (tx?.card_id) return `card:${tx.card_id}`;
  if (tx?.account_id) return `account:${tx.account_id}`;
  return tx?.type === "income" ? "" : "cash";
};

export default function TransactionModal({ open, onClose, onSaved, initial, defaultDate }) {
  const editing = Boolean(initial?.id);
  const [accounts, setAccounts] = useState([]);
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summaries, setSummaries] = useState([]); // 개요 자동완성 후보
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    transaction_date: defaultDate || todayStr(),
    category_id: "",
    summary: "",
    description: "",
    payment: "", // 결제수단: "card:<id>" | "account:<id>" | "cash"
  });

  useEffect(() => {
    if (!open) return;
    setError("");
    Promise.all([
      accountsApi.list(),
      cardsApi.list(),
      categoriesApi.list(),
      transactionsApi.summaries(),
    ]).then(([a, c, cat, sug]) => {
      setAccounts(a.data);
      setCards(c.data);
      setCategories(cat.data);
      setSummaries(sug.data || []);
    });
    if (initial) {
      setForm({
        type: initial.type ?? "expense",
        amount: initial.amount?.toString() ?? "",
        transaction_date: initial.transaction_date ?? defaultDate ?? todayStr(),
        category_id: initial.category_id ?? "",
        summary: initial.summary ?? "",
        description: initial.description ?? "",
        payment: derivePayment(initial),
      });
    } else {
      setForm((f) => ({
        ...f,
        type: "expense",
        amount: "",
        category_id: "",
        summary: "",
        description: "",
        payment: "",
        transaction_date: defaultDate || todayStr(),
      }));
    }
  }, [open, initial, defaultDate]);

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // 수입/지출 전환 시 카테고리·결제수단 초기화 (타입별로 선택지가 다름)
  const changeType = (t) => setForm((f) => ({ ...f, type: t, category_id: "", payment: "" }));

  // ---- 2-depth 카테고리 파생값 ----
  const byOrder = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const parents = categories.filter((c) => c.type === form.type && !c.parent_id).sort(byOrder);
  const currentCat = catMap[form.category_id];
  const selectedParentId = currentCat ? currentCat.parent_id || currentCat.id : "";
  const children = categories.filter((c) => c.parent_id === selectedParentId).sort(byOrder);
  const selectedChildId = currentCat && currentCat.parent_id ? currentCat.id : "";

  const onParentChange = (pid) => set("category_id", pid || ""); // 부모 선택 = 1-depth 지정
  const onChildChange = (cid) => set("category_id", cid || selectedParentId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.amount || Number(form.amount) < 0) {
      setError("금액을 올바르게 입력하세요.");
      return;
    }
    if (!selectedParentId) {
      setError("카테고리(상위)를 선택하세요.");
      return;
    }
    if (!form.payment) {
      setError(form.type === "income" ? "계좌를 선택하세요." : "결제수단을 선택하세요.");
      return;
    }
    let account_id = null;
    let card_id = null;
    if (form.payment.startsWith("account:")) account_id = form.payment.slice(8);
    else if (form.payment.startsWith("card:")) card_id = form.payment.slice(5);
    // "cash" → account_id, card_id 모두 null
    const payload = {
      type: form.type,
      amount: parseInt(form.amount, 10),
      transaction_date: form.transaction_date,
      category_id: form.category_id || null,
      summary: form.summary.trim() || null,
      description: form.description || null,
      account_id,
      card_id,
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

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm("이 거래를 삭제할까요?")) return;
    setError("");
    setSaving(true);
    try {
      await transactionsApi.remove(initial.id);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "삭제에 실패했습니다. (본인 거래만 삭제 가능)");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">{editing ? "거래 수정" : "거래 추가"}</h2>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 개요 (최상단) */}
          <div>
            <label className="mb-1 block text-sm text-gray-600">개요</label>
            <input
              type="text"
              list="summary-suggestions"
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="예: 점심, 월급, 마트 장보기"
              autoComplete="off"
            />
            <datalist id="summary-suggestions">
              {summaries.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* 수입/지출 토글 */}
          <div className="grid grid-cols-2 gap-2">
            {["expense", "income"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => changeType(t)}
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                카테고리 <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedParentId}
                onChange={(e) => onParentChange(e.target.value)}
                required
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="">선택</option>
                {parents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">세부 카테고리</label>
              <select
                value={selectedChildId}
                onChange={(e) => onChildChange(e.target.value)}
                disabled={!selectedParentId || children.length === 0}
                className="w-full rounded-lg border px-3 py-2 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">{selectedParentId ? "상위 전체" : "-"}</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-600">
              {form.type === "income" ? "계좌" : "결제수단"} <span className="text-red-500">*</span>
            </label>
            <select
              value={form.payment}
              onChange={(e) => set("payment", e.target.value)}
              required
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="">선택</option>
              {form.type === "expense" && (
                <optgroup label="카드">
                  {cards.map((c) => (
                    <option key={c.id} value={`card:${c.id}`}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="계좌">
                {accounts.map((a) => (
                  <option key={a.id} value={`account:${a.id}`}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
              {form.type === "expense" && <option value="cash">현금</option>}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-600">메모</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="w-full resize-y rounded-lg border px-3 py-2"
              placeholder="여러 줄 메모를 입력할 수 있습니다"
            />
          </div>

          <div className="flex gap-2 pt-2">
            {editing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                삭제
              </button>
            )}
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
