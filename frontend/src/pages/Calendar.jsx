import { useEffect, useState } from "react";
import { formatWon, transactionsApi } from "../api";
import CalendarGrid from "../components/CalendarGrid";
import TransactionModal from "../components/TransactionModal";

export default function Calendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0, by_date: {} });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  const load = () => {
    transactionsApi.summary({ year, month }).then((res) => setSummary(res.data));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  };

  const openForDate = (dateStr) => {
    setSelectedDate(dateStr);
    setModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="rounded-lg border px-3 py-1.5 hover:bg-gray-50">
            ‹
          </button>
          <h1 className="text-xl font-bold">
            {year}년 {month}월
          </h1>
          <button onClick={nextMonth} className="rounded-lg border px-3 py-1.5 hover:bg-gray-50">
            ›
          </button>
        </div>
        <button
          onClick={() => openForDate(null)}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
        >
          + 거래 추가
        </button>
      </div>

      {/* 월 요약 */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white p-4 text-center">
          <p className="text-xs text-gray-500">수입</p>
          <p className="mt-1 font-bold text-blue-600">{formatWon(summary.income)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 text-center">
          <p className="text-xs text-gray-500">지출</p>
          <p className="mt-1 font-bold text-red-600">{formatWon(summary.expense)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 text-center">
          <p className="text-xs text-gray-500">합계</p>
          <p className={`mt-1 font-bold ${summary.balance >= 0 ? "text-blue-600" : "text-red-600"}`}>
            {formatWon(summary.balance)}
          </p>
        </div>
      </div>

      <CalendarGrid
        year={year}
        month={month}
        byDate={summary.by_date}
        onSelectDate={openForDate}
      />

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        defaultDate={selectedDate}
      />
    </div>
  );
}
