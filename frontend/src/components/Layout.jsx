import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/calendar", label: "캘린더" },
  { to: "/transactions", label: "거래내역" },
  { to: "/categories", label: "카테고리" },
  { to: "/cards", label: "카드" },
  { to: "/accounts", label: "계좌" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const linkClass = ({ isActive }) =>
    `block rounded-lg px-4 py-2 text-sm font-medium transition ${
      isActive ? "bg-blue-500 text-white" : "text-gray-700 hover:bg-gray-100"
    }`;

  const SidebarContent = (
    <div className="flex h-full flex-col">
      {/* 사용자 정보 */}
      <div className="border-b px-4 py-5">
        <p className="text-lg font-bold text-gray-900">{user?.name}</p>
        <span
          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
            user?.role === "admin"
              ? "bg-purple-100 text-purple-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {user?.role === "admin" ? "관리자" : "구성원"}
        </span>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass} onClick={() => setOpen(false)}>
            {item.label}
          </NavLink>
        ))}
        {user?.role === "admin" && (
          <NavLink to="/settings" className={linkClass} onClick={() => setOpen(false)}>
            설정
          </NavLink>
        )}
      </nav>

      {/* 로그아웃 */}
      <div className="border-t p-3">
        <button
          onClick={handleLogout}
          className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          로그아웃
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* 모바일 상단바 */}
      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b bg-white px-4 py-3 md:hidden">
        <span className="font-bold">공유 가계부</span>
        <button onClick={() => setOpen(!open)} className="rounded p-2 hover:bg-gray-100">
          ☰
        </button>
      </header>

      {/* 사이드바 (데스크탑) */}
      <aside className="hidden w-60 shrink-0 border-r bg-white md:block">{SidebarContent}</aside>

      {/* 사이드바 (모바일 드로어) */}
      {open && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 bg-white shadow-xl">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* 본문 */}
      <main className="flex-1 px-4 pb-10 pt-16 md:px-8 md:pt-8">{children}</main>
    </div>
  );
}
