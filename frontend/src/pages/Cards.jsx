import { useEffect, useState } from "react";
import { accountsApi, cardsApi } from "../api";
import { useAuth } from "../context/AuthContext";

const emptyForm = {
  name: "",
  account_id: "",
  card_type: "credit",
  issuer: "",
  benefits: "",
};

export default function Cards() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const load = () => {
    cardsApi.list().then((res) => setRows(res.data));
    accountsApi.list().then((res) => setAccounts(res.data));
  };

  useEffect(() => {
    load();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return;
    try {
      await cardsApi.create({
        name: form.name,
        account_id: form.account_id || null,
        card_type: form.card_type,
        issuer: form.issuer || null,
        benefits: form.benefits || null,
      });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "추가에 실패했습니다.");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("이 카드를 삭제할까요?")) return;
    try {
      await cardsApi.remove(id);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "본인 카드만 삭제할 수 있습니다.");
    }
  };

  const accountName = (id) => accounts.find((a) => a.id === id)?.name || "-";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">카드</h1>

      <form onSubmit={handleCreate} className="mb-6 space-y-2 rounded-xl border bg-white p-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="카드 이름" className="rounded-lg border px-3 py-2" />
          <select value={form.card_type} onChange={(e) => set("card_type", e.target.value)} className="rounded-lg border px-3 py-2">
            <option value="credit">신용</option>
            <option value="debit">체크</option>
          </select>
          <input value={form.issuer} onChange={(e) => set("issuer", e.target.value)} placeholder="발급사" className="rounded-lg border px-3 py-2" />
          <select value={form.account_id} onChange={(e) => set("account_id", e.target.value)} className="rounded-lg border px-3 py-2">
            <option value="">연결 계좌 없음</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <input value={form.benefits} onChange={(e) => set("benefits", e.target.value)} placeholder="혜택 (메모)" className="w-full rounded-lg border px-3 py-2" />
        <button className="w-full rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-600 sm:w-auto">
          추가
        </button>
      </form>

      <div className="space-y-2">
        {rows.length === 0 && <p className="py-8 text-center text-sm text-gray-400">등록된 카드가 없습니다.</p>}
        {rows.map((c) => (
          <div key={c.id} className="rounded-xl border bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">{c.name}</p>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {c.card_type === "credit" ? "신용" : "체크"}
                </span>
              </div>
              {c.user_id === user?.id && (
                <button onClick={() => handleDelete(c.id)} className="text-xs text-gray-400 hover:text-red-600">
                  삭제
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {c.issuer || "-"} · 계좌: {accountName(c.account_id)}
            </p>
            {c.benefits && <p className="mt-1 text-xs text-gray-500">혜택: {c.benefits}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
