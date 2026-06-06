import { formatWon } from "../api";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * byDate: { "YYYY-MM-DD": { income, expense } }
 * onSelectDate(dateStr)
 */
export default function CalendarGrid({ year, month, byDate = {}, onSelectDate }) {
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=일
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pad = (n) => String(n).padStart(2, "0");
  const dateKey = (d) => `${year}-${pad(month)}-${pad(d)}`;

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b bg-gray-50 text-center text-xs font-semibold">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`py-2 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-600"}`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div className="grid grid-cols-7">
        {cells.map((d, idx) => {
          if (d === null) return <div key={`e${idx}`} className="min-h-[72px] border-b border-r bg-gray-50/50" />;
          const info = byDate[dateKey(d)];
          return (
            <button
              key={d}
              onClick={() => onSelectDate?.(dateKey(d))}
              className="min-h-[72px] border-b border-r p-1 text-left align-top transition hover:bg-blue-50"
            >
              <span className="text-xs font-medium text-gray-700">{d}</span>
              {info && (
                <div className="mt-1 space-y-0.5">
                  {info.income > 0 && (
                    <div className="truncate text-[10px] font-semibold text-blue-600">
                      +{formatWon(info.income)}
                    </div>
                  )}
                  {info.expense > 0 && (
                    <div className="truncate text-[10px] font-semibold text-red-600">
                      -{formatWon(info.expense)}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
