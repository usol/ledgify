"""카테고리 라우터 테스트 (전역 공유, 모든 로그인 사용자 관리 가능)."""
from types import SimpleNamespace

import routers.categories as cat_router
from middleware import get_current_user


def _auth(app, make_user, role="member"):
    app.dependency_overrides[get_current_user] = lambda: make_user(role=role)


def test_categories_require_auth(client):
    assert client.get("/api/categories").status_code == 401


def test_member_can_list_categories(client, app, make_user, fake_client_factory, monkeypatch):
    """관리자 전용이 아니라 일반 구성원도 접근 가능해야 한다."""
    _auth(app, make_user, role="member")
    data = [{"id": "c1", "type": "expense", "name": "식비", "parent_id": None, "created_at": "x"}]
    monkeypatch.setattr(cat_router, "supabase_admin", fake_client_factory({"categories": data}))
    try:
        res = client.get("/api/categories")
        assert res.status_code == 200
        assert res.json()[0]["name"] == "식비"
    finally:
        app.dependency_overrides.clear()


def test_create_parent_category(client, app, make_user, monkeypatch):
    _auth(app, make_user)
    captured = {}

    class Fake:
        def __init__(self):
            self._mode = None
        def table(self, _):
            return self
        def select(self, *a, **k):
            self._mode = "select"
            return self
        def eq(self, *a, **k):
            return self
        def is_(self, *a, **k):
            return self
        def insert(self, payload):
            captured.update(payload)
            self._mode = "insert"
            return self
        def execute(self):
            if self._mode == "insert":
                return SimpleNamespace(data=[{**captured, "id": "new"}])
            return SimpleNamespace(data=[])  # 중복 검사: 없음

    monkeypatch.setattr(cat_router, "supabase_admin", Fake())
    try:
        res = client.post("/api/categories", json={"type": "expense", "name": "  여행 "})
        assert res.status_code == 201
        assert captured["name"] == "여행"  # 공백 trim
        assert captured["parent_id"] is None
        assert captured["type"] == "expense"
    finally:
        app.dependency_overrides.clear()


def test_create_child_with_invalid_parent_fails(client, app, make_user, fake_client_factory, monkeypatch):
    _auth(app, make_user)
    # 부모 조회 결과가 없도록 categories 데이터를 None 으로
    monkeypatch.setattr(cat_router, "supabase_admin", fake_client_factory({"categories": None}))
    try:
        res = client.post(
            "/api/categories", json={"type": "expense", "name": "택시", "parent_id": "nope"}
        )
        assert res.status_code == 400
    finally:
        app.dependency_overrides.clear()


def test_delete_with_usage_requires_reassign(client, app, make_user, monkeypatch):
    """사용 중인 카테고리는 reassign_to 없이 삭제 시 409 + REASSIGN_REQUIRED 반환."""
    _auth(app, make_user)

    class Fake:
        """exists=있음, children=없음, used 거래=2건 시나리오."""
        def __init__(self):
            self._table = None
        def table(self, name):
            self._table = name
            return self
        def select(self, *a, **k):
            return self
        def eq(self, col, *a, **k):
            self._col = col
            return self
        def execute(self):
            if self._table == "categories" and getattr(self, "_col", None) == "parent_id":
                return SimpleNamespace(data=[])  # 하위 없음
            if self._table == "categories":
                return SimpleNamespace(data=[{"id": "c1"}])  # 존재
            if self._table == "transactions":
                return SimpleNamespace(data=[{"id": "t1"}, {"id": "t2"}])  # 사용 2건
            return SimpleNamespace(data=[])

    monkeypatch.setattr(cat_router, "supabase_admin", Fake())
    try:
        res = client.delete("/api/categories/c1")
        assert res.status_code == 409
        assert res.json()["detail"] == "REASSIGN_REQUIRED:2"
    finally:
        app.dependency_overrides.clear()
