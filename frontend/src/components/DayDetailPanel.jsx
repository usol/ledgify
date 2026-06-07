import { categoryLabel, formatWon } from "../api";

/**
 * 캘린더 하단에 인라인으로 표시되는 '선택한 날짜'의 거래 목록.
 * - 항목 클릭 -> onSelect(tx)  (팝업에서 수정/삭제)
 * - + 추가    -> onAdd()
 */
export default function DayDetailPanel({ date, transactions = [], categories = [], onAdd, onSelect }) {
  if (!date) {
    return (
      <div className="mt-4 rounded-xl border bg-white p-6 text-center text-sm text-gray-400">
        날짜를 선택하면 해당 일자의 수입·지출 목록이 표시됩니다.
      </div>
    );
  }

  const incomes = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");

  const prettyDate = new Date(date + "T00:00:00").toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const Item = ({ t }) => (
    <li>
      <button
        onClick={() => onSelect(t)}
        className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition hover:bg-gray-50"
      >
        <span className="min-w-0">
          <span className="text-sm font-medium text-gray-900">
            {categoryLabel(t.category_id, categories) || t.category || "기타"}
          </span>
          {t.summary && (
            <span className="ml-2 truncate text-xs text-gray-500">{t.summary}</span>
          )}
        </span>
        <span className={`shrink-0 font-semibold ${t.type === "income" ? "text-blue-600" : "text-red-600"}`}>
          {t.type === "income" ? "+" : "-"}
          {formatWon(t.amount)}
        </span>
      </button>
    </li>
  );

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-gray-900">{prettyDate}</h2>
        <button
          onClick={onAdd}
          className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
        >
          + 추가
        </button>
      </div>

      {/* 목록이 길어지면 이 영역만 세로 스크롤 (헤더는 위에 고정) */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {transactions.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">이 날짜에 입력된 거래가 없습니다.</p>
        )}

        {incomes.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold text-blue-600">수입 {incomes.length}건</h3>
            <ul className="space-y-2">
              {incomes.map((t) => (
                <Item key={t.id} t={t} />
              ))}
            </ul>
          </section>
        )}

        {expenses.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold text-red-600">지출 {expenses.length}건</h3>
            <ul className="space-y-2">
              {expenses.map((t) => (
                <Item key={t.id} t={t} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
