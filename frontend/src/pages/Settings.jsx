import { useEffect, useState } from "react";
import { usersApi } from "../api";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const load = () => usersApi.list().then((res) => setMembers(res.data));

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email || !form.password) {
      setError("모든 항목을 입력하세요.");
      return;
    }
    try {
      await usersApi.create(form);
      setForm({ name: "", email: "", password: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "구성원 추가에 실패했습니다.");
    }
  };

  const handleRename = async (id) => {
    try {
      await usersApi.update(id, editName);
      setEditId(null);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "이름 변경에 실패했습니다.");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("이 구성원을 삭제할까요? (로그인 계정도 함께 삭제됩니다)")) return;
    try {
      await usersApi.remove(id);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "삭제에 실패했습니다.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">설정 · 구성원 관리</h1>

      {/* 구성원 추가 */}
      <form onSubmit={handleCreate} className="mb-6 space-y-2 rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700">구성원 추가</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="이름"
            className="rounded-lg border px-3 py-2"
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="이메일"
            className="rounded-lg border px-3 py-2"
          />
          <input
            type="text"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="초기 비밀번호"
            className="rounded-lg border px-3 py-2"
          />
        </div>
        <button className="rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-600">
          추가
        </button>
      </form>

      {/* 구성원 목록 */}
      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-xl border bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              {editId === m.id ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-lg border px-2 py-1 text-sm"
                  autoFocus
                />
              ) : (
                <span className="font-medium text-gray-900">{m.name}</span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  m.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                }`}
              >
                {m.role === "admin" ? "관리자" : "구성원"}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              {editId === m.id ? (
                <>
                  <button onClick={() => handleRename(m.id)} className="font-semibold text-blue-600">
                    저장
                  </button>
                  <button onClick={() => setEditId(null)} className="text-gray-400">
                    취소
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setEditId(m.id);
                    setEditName(m.name);
                  }}
                  className="text-gray-400 hover:text-gray-700"
                >
                  이름변경
                </button>
              )}
              {/* 본인(관리자) 계정은 삭제 불가 */}
              {m.id !== user?.id && (
                <button onClick={() => handleDelete(m.id)} className="text-gray-400 hover:text-red-600">
                  삭제
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
