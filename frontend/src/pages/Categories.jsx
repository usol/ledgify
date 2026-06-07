import { useEffect, useState } from "react";
import { categoriesApi } from "../api";
import SortableList, { DragHandle } from "../components/SortableList";

const TYPES = [
  { key: "expense", label: "지출", color: "text-red-600" },
  { key: "income", label: "수입", color: "text-blue-600" },
];

export default function Categories() {
  const [cats, setCats] = useState([]);
  const [newParent, setNewParent] = useState({ expense: "", income: "" });
  const [childInput, setChildInput] = useState({}); // parentId -> name
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState({ expense: false, income: false });
  // 이관 모달 상태
  const [reassign, setReassign] = useState(null); // { cat, count, target }

  const load = () => categoriesApi.list().then((res) => setCats(res.data));

  useEffect(() => {
    load();
  }, []);

  const byOrder = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);
  const parentsOf = (type) => cats.filter((c) => c.type === type && !c.parent_id).sort(byOrder);
  const childrenOf = (parentId) => cats.filter((c) => c.parent_id === parentId).sort(byOrder);

  // 같은 그룹 내 순서 변경 (상위끼리 또는 한 부모의 하위끼리). 낙관적으로 sort_order 갱신.
  const reorderGroup = async (ordered) => {
    const idToOrder = new Map(ordered.map((c, i) => [c.id, i]));
    setCats((prev) => prev.map((c) => (idToOrder.has(c.id) ? { ...c, sort_order: idToOrder.get(c.id) } : c)));
    try {
      await categoriesApi.reorder(ordered.map((c) => c.id));
    } catch (e) {
      setError(e.response?.data?.detail || "순서 변경에 실패했습니다.");
      load();
    }
  };

  const addParent = async (type) => {
    const name = (newParent[type] || "").trim();
    if (!name) return;
    setError("");
    try {
      await categoriesApi.create({ type, name });
      setNewParent((s) => ({ ...s, [type]: "" }));
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "추가 실패");
    }
  };

  const addChild = async (parent) => {
    const name = (childInput[parent.id] || "").trim();
    if (!name) return;
    setError("");
    try {
      await categoriesApi.create({ type: parent.type, name, parent_id: parent.id });
      setChildInput((s) => ({ ...s, [parent.id]: "" }));
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "추가 실패");
    }
  };

  const saveRename = async (id) => {
    if (!editName.trim()) return;
    try {
      await categoriesApi.update(id, editName.trim());
      setEditId(null);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || "이름 변경 실패");
    }
  };

  // 삭제: 먼저 이관 없이 시도 → 사용 중이면 이관 모달
  const tryDelete = async (cat) => {
    if (!confirm(`'${cat.name}' 카테고리를 삭제할까요?`)) return;
    try {
      await categoriesApi.remove(cat.id);
      load();
    } catch (e) {
      const detail = e.response?.data?.detail || "";
      if (typeof detail === "string" && detail.startsWith("REASSIGN_REQUIRED:")) {
        const count = parseInt(detail.split(":")[1], 10) || 0;
        setReassign({ cat, count, target: "" });
      } else if (e.response?.status === 409) {
        alert(detail); // 하위 카테고리 존재 등
      } else if (e.response?.status === 404) {
        load();
      } else {
        alert(detail || "삭제 실패");
      }
    }
  };

  const confirmReassign = async () => {
    if (!reassign?.target) {
      alert("이관할 카테고리를 선택하세요.");
      return;
    }
    try {
      await categoriesApi.remove(reassign.cat.id, reassign.target);
      setReassign(null);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || "이관/삭제 실패");
    }
  };

  // 이관 후보: 같은 type, 삭제 대상과 그 자식 제외
  const reassignOptions = () => {
    if (!reassign) return [];
    const excluded = new Set([reassign.cat.id, ...childrenOf(reassign.cat.id).map((c) => c.id)]);
    return cats
      .filter((c) => c.type === reassign.cat.type && !excluded.has(c.id))
      .map((c) => ({
        id: c.id,
        label: c.parent_id
          ? `${cats.find((p) => p.id === c.parent_id)?.name} > ${c.name}`
          : c.name,
      }));
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-bold">카테고리 관리</h1>
      <p className="mb-4 text-sm text-gray-500">
        모든 사용자가 공유하며 누구나 추가·수정·삭제할 수 있습니다. 상위 / 하위 2단계로 구성됩니다.
      </p>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      {TYPES.map((t) => (
        <section key={t.key} className="mb-8">
          <button
            onClick={() => setCollapsed((s) => ({ ...s, [t.key]: !s[t.key] }))}
            className="mb-2 flex w-full items-center gap-2"
          >
            <span className={`text-xs text-gray-400 transition-transform ${collapsed[t.key] ? "" : "rotate-90"}`}>
              ▶
            </span>
            <span className={`font-bold ${t.color}`}>{t.label}</span>
            <span className="text-xs font-normal text-gray-400">
              ({parentsOf(t.key).length})
            </span>
          </button>

          {collapsed[t.key] ? null : (
          <>
          {/* 상위 카테고리 추가 */}
          <div className="mb-3 flex gap-2">
            <input
              value={newParent[t.key]}
              onChange={(e) => setNewParent((s) => ({ ...s, [t.key]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addParent(t.key)}
              placeholder={`${t.label} 상위 카테고리 추가`}
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
            />
            <button
              onClick={() => addParent(t.key)}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              추가
            </button>
          </div>

          {parentsOf(t.key).length === 0 ? (
            <p className="text-sm text-gray-400">등록된 카테고리가 없습니다.</p>
          ) : (
            <SortableList
              items={parentsOf(t.key)}
              onReorder={reorderGroup}
              renderItem={(p, handle) => (
                <div className="rounded-xl border bg-white p-3">
                  {/* 상위 행 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <DragHandle handle={handle} />
                      {editId === p.id ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveRename(p.id)}
                          className="rounded-lg border px-2 py-1 text-sm"
                          autoFocus
                        />
                      ) : (
                        <span className="font-semibold text-gray-900">{p.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {editId === p.id ? (
                        <>
                          <button onClick={() => saveRename(p.id)} className="font-semibold text-blue-600">저장</button>
                          <button onClick={() => setEditId(null)} className="text-gray-400">취소</button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setEditId(p.id);
                            setEditName(p.name);
                          }}
                          className="text-gray-400 hover:text-gray-700"
                        >
                          이름변경
                        </button>
                      )}
                      <button onClick={() => tryDelete(p)} className="text-gray-400 hover:text-red-600">
                        삭제
                      </button>
                    </div>
                  </div>

                  {/* 하위 카테고리들 */}
                  <div className="mt-2 space-y-1 pl-4">
                    {childrenOf(p.id).length > 0 && (
                      <SortableList
                        items={childrenOf(p.id)}
                        onReorder={reorderGroup}
                        wrapperClassName="space-y-1"
                        renderItem={(c, chandle) => (
                          <div className="flex items-center justify-between border-l-2 pl-1">
                            <div className="flex items-center gap-1">
                              <DragHandle handle={chandle} />
                              {editId === c.id ? (
                                <input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && saveRename(c.id)}
                                  className="rounded-lg border px-2 py-1 text-sm"
                                  autoFocus
                                />
                              ) : (
                                <span className="text-sm text-gray-700">{c.name}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              {editId === c.id ? (
                                <>
                                  <button onClick={() => saveRename(c.id)} className="font-semibold text-blue-600">저장</button>
                                  <button onClick={() => setEditId(null)} className="text-gray-400">취소</button>
                                </>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditId(c.id);
                                    setEditName(c.name);
                                  }}
                                  className="text-gray-400 hover:text-gray-700"
                                >
                                  이름변경
                                </button>
                              )}
                              <button onClick={() => tryDelete(c)} className="text-gray-400 hover:text-red-600">
                                삭제
                              </button>
                            </div>
                          </div>
                        )}
                      />
                    )}

                    {/* 하위 추가 */}
                    <div className="flex gap-2 pt-1">
                      <input
                        value={childInput[p.id] || ""}
                        onChange={(e) => setChildInput((s) => ({ ...s, [p.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && addChild(p)}
                        placeholder="하위 카테고리 추가"
                        className="flex-1 rounded-lg border px-2 py-1 text-sm"
                      />
                      <button
                        onClick={() => addChild(p)}
                        className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        추가
                      </button>
                    </div>
                  </div>
                </div>
              )}
            />
          )}
          </>
          )}
        </section>
      ))}

      {/* 이관 모달 */}
      {reassign && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReassign(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold">카테고리 이관</h2>
            <p className="mb-4 text-sm text-gray-600">
              <b>{reassign.cat.name}</b> 카테고리를 사용하는 거래가 <b>{reassign.count}건</b> 있습니다.
              삭제하려면 이 거래들을 옮길 카테고리를 선택하세요.
            </p>
            <select
              value={reassign.target}
              onChange={(e) => setReassign((r) => ({ ...r, target: e.target.value }))}
              className="mb-4 w-full rounded-lg border px-3 py-2"
            >
              <option value="">이관할 카테고리 선택</option>
              {reassignOptions().map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setReassign(null)}
                className="flex-1 rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={confirmReassign}
                className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                이관 후 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
