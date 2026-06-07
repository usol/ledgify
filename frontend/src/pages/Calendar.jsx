import { useEffect, useState } from "react";
import { categoriesApi, formatWon, transactionsApi } from "../api";
import CalendarGrid from "../components/CalendarGrid";
import DayDetailPanel from "../components/DayDetailPanel";
import TransactionModal from "../components/TransactionModal";

const pad = (n) => String(n).padStart(2, "0");

export default function Calendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0, by_date: {} });
  const [rows, setRows] = useState([]); // 이번 달 전체 거래
  const [categories, setCategories] = useState([]);
  // 초기 선택일: 오늘
  const [selectedDate, setSelectedDate] = useState(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  );
  const [txOpen, setTxOpen] = useState(false); // 추가/수정 모달
  const [editing, setEditing] = useState(null); // 수정 대상 거래

  const load = () => {
    transactionsApi.summary({ year, month }).then((res) => setSummary(res.data));
    transactionsApi.list({ year, month }).then((res) => setRows(res.data));
  };

  useEffect(() => {
    categoriesApi.list().then((res) => setCategories(res.data));
  }, []);

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

  // 캘린더에서 날짜 클릭 -> 하단 패널에 그 날짜 목록 표시
  const openDay = (dateStr) => setSelectedDate(dateStr);

  // 선택한 날짜 기준 새 거래 추가 (하단 패널의 + 추가)
  const openAddNew = () => {
    setEditing(null);
    setTxOpen(true);
  };

  // 목록 항목 선택 -> 수정/삭제 팝업
  const editTransaction = (tx) => {
    setEditing(tx);
    setTxOpen(true);
  };

  // 선택한 날짜의 거래만 필터
  const dayRows = selectedDate ? rows.filter((t) => t.transaction_date === selectedDate) : [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col tall:h-full">
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
      </div>

      {/* 월 요약 (한 줄로 압축, 일별 집계처럼 배경색) */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
        <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-1.5">
          <span className="text-xs text-gray-500">수입</span>
          <span className="font-bold text-blue-600">{formatWon(summary.income)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-1.5">
          <span className="text-xs text-gray-500">지출</span>
          <span className="font-bold text-red-600">{formatWon(summary.expense)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-1.5">
          <span className="text-xs text-gray-500">합계</span>
          <span className="font-bold text-green-600">{formatWon(summary.balance)}</span>
        </div>
      </div>

      <CalendarGrid
        year={year}
        month={month}
        byDate={summary.by_date}
        onSelectDate={openDay}
      />

      {/* 캘린더 하단: 선택한 날짜의 수입/지출 목록 (인라인) */}
      <DayDetailPanel
        date={selectedDate}
        transactions={dayRows}
        categories={categories}
        onAdd={openAddNew}
        onSelect={editTransaction}
      />

      {/* 항목 선택/추가 시 뜨는 수정·삭제 팝업 */}
      <TransactionModal
        open={txOpen}
        onClose={() => setTxOpen(false)}
        onSaved={load}
        initial={editing}
        defaultDate={selectedDate}
      />
    </div>
  );
}
