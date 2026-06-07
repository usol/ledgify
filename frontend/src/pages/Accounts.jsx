import { useEffect, useState } from "react";
import { accountsApi } from "../api";
import { useAuth } from "../context/AuthContext";
import SortableList, { DragHandle } from "../components/SortableList";

export default function Accounts() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: "", bank_name: "" });
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", bank_name: "" });

  const load = () => accountsApi.list().then((res) => setRows(res.data));

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return;
    try {
      await accountsApi.create({ name: form.name, bank_name: form.bank_name || null });
      setForm({ name: "", bank_name: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "추가에 실패했습니다.");
    }
  };

  const startEdit = (a) => {
    setError("");
    setEditingId(a.id);
    setEditForm({ name: a.name, bank_name: a.bank_name || "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: "", bank_name: "" });
  };

  const handleUpdate = async (id) => {
    setError("");
    if (!editForm.name.trim()) return;
    try {
      await accountsApi.update(id, { name: editForm.name, bank_name: editForm.bank_name || null });
      cancelEdit();
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "수정에 실패했습니다. (본인 계좌만 수정 가능)");
    }
  };

  const handleReorder = async (newRows) => {
    setRows(newRows); // 낙관적 업데이트
    try {
      await accountsApi.reorder(newRows.map((r) => r.id));
    } catch (err) {
      setError(err.response?.data?.detail || "순서 변경에 실패했습니다.");
      load(); // 실패 시 서버 순서로 복구
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("이 계좌를 삭제할까요?")) return;
    try {
      await accountsApi.remove(id);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "본인 계좌만 삭제할 수 있습니다.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">계좌</h1>

      <form onSubmit={handleCreate} className="mb-6 rounded-xl border bg-white p-4">
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="계좌 이름"
            className="rounded-lg border px-3 py-2"
          />
          <input
            value={form.bank_name}
            onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
            placeholder="은행명"
            className="rounded-lg border px-3 py-2"
          />
          <button className="rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-600">
            추가
          </button>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">등록된 계좌가 없습니다.</p>
      ) : (
        <SortableList
          items={rows}
          onReorder={handleReorder}
          renderItem={(a, handle) =>
            editingId === a.id ? (
              <div className="rounded-xl border bg-white px-4 py-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="계좌 이름"
                    className="rounded-lg border px-3 py-2"
                  />
                  <input
                    value={editForm.bank_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, bank_name: e.target.value }))}
                    placeholder="은행명"
                    className="rounded-lg border px-3 py-2"
                  />
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    onClick={cancelEdit}
                    className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => handleUpdate(a.id)}
                    className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border bg-white py-3 pl-2 pr-4">
                <div className="flex items-center gap-1">
                  <DragHandle handle={handle} />
                  <div>
                    <p className="font-medium text-gray-900">{a.name}</p>
                    <p className="text-xs text-gray-400">{a.bank_name || "-"}</p>
                  </div>
                </div>
                {a.user_id === user?.id && (
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(a)} className="text-xs text-gray-400 hover:text-blue-600">
                      수정
                    </button>
                    <button onClick={() => handleDelete(a.id)} className="text-xs text-gray-400 hover:text-red-600">
                      삭제
                    </button>
                  </div>
                )}
              </div>
            )
          }
        />
      )}
    </div>
  );
}
