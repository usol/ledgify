import { useEffect, useState } from "react";
import { categoriesApi, categoryLabel, formatWon, transactionsApi } from "../api";
import TransactionModal from "../components/TransactionModal";

export default function Transactions() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => {
    transactionsApi.list({ year, month }).then((res) => setRows(res.data));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => {
    categoriesApi.list().then((res) => setCategories(res.data));
  }, []);

  const handleEdit = (tx) => {
    setEditing(tx);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("이 거래를 삭제할까요?")) return;
    try {
      await transactionsApi.remove(id);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "삭제에 실패했습니다. (본인 거래만 삭제 가능)");
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">거래내역</h1>
        <div className="flex items-center gap-2">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-lg border px-2 py-1.5">
            {years.map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-lg border px-2 py-1.5">
            {months.map((m) => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
          <button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
          >
            + 추가
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-400">거래 내역이 없습니다.</p>
        )}
        {rows.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between rounded-xl border bg-white px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {categoryLabel(tx.category_id, categories) || tx.category || "기타"}
                </span>
                {tx.summary && (
                  <span className="truncate text-xs text-gray-500">· {tx.summary}</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-400">{tx.transaction_date}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-bold ${tx.type === "income" ? "text-blue-600" : "text-red-600"}`}>
                {tx.type === "income" ? "+" : "-"}
                {formatWon(tx.amount)}
              </span>
              <button onClick={() => handleEdit(tx)} className="text-xs text-gray-400 hover:text-gray-700">
                수정
              </button>
              <button onClick={() => handleDelete(tx.id)} className="text-xs text-gray-400 hover:text-red-600">
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        initial={editing}
      />
    </div>
  );
}
