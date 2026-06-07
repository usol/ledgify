"""거래 라우터 테스트: 인증은 오버라이드, DB 는 FakeClient."""
import routers.transactions as tx_router
from middleware import get_current_user


def _override_auth(app, make_user, role="member"):
    user = make_user(role=role)
    app.dependency_overrides[get_current_user] = lambda: user
    return user


def test_list_transactions(client, app, make_user, fake_client_factory, monkeypatch):
    _override_auth(app, make_user)
    rows = [
        {"id": "t1", "type": "expense", "amount": 5000, "transaction_date": "2026-06-01"},
        {"id": "t2", "type": "income", "amount": 30000, "transaction_date": "2026-06-02"},
    ]
    monkeypatch.setattr(
        tx_router, "get_user_client", lambda token: fake_client_factory({"transactions": rows})
    )
    try:
        res = client.get("/api/transactions", params={"year": 2026, "month": 6})
        assert res.status_code == 200
        assert len(res.json()) == 2
    finally:
        app.dependency_overrides.clear()


def test_create_transaction_sets_user_id(client, app, make_user, monkeypatch):
    user = _override_auth(app, make_user)
    captured = {}

    class Cap:
        def table(self, _):
            return self
        def insert(self, payload):
            captured.update(payload)
            return self
        def execute(self):
            return type("R", (), {"data": [{**captured, "id": "new"}]})()

    monkeypatch.setattr(tx_router, "get_user_client", lambda token: Cap())
    try:
        res = client.post(
            "/api/transactions",
            json={"type": "expense", "amount": 1200, "transaction_date": "2026-06-06"},
        )
        assert res.status_code == 201
        # 서버가 user_id 를 요청자 본인으로 강제하는지 확인
        assert captured["user_id"] == user.id
        assert captured["amount"] == 1200
    finally:
        app.dependency_overrides.clear()


def test_create_transaction_rejects_negative_amount(client, app, make_user):
    _override_auth(app, make_user)
    try:
        res = client.post(
            "/api/transactions",
            json={"type": "expense", "amount": -5, "transaction_date": "2026-06-06"},
        )
        assert res.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_summary_aggregates(client, app, make_user, fake_client_factory, monkeypatch):
    _override_auth(app, make_user)
    rows = [
        {"type": "income", "amount": 100000, "transaction_date": "2026-06-01"},
        {"type": "expense", "amount": 30000, "transaction_date": "2026-06-01"},
        {"type": "expense", "amount": 20000, "transaction_date": "2026-06-02"},
    ]
    monkeypatch.setattr(
        tx_router, "get_user_client", lambda token: fake_client_factory({"transactions": rows})
    )
    try:
        res = client.get("/api/transactions/summary", params={"year": 2026, "month": 6})
        assert res.status_code == 200
        body = res.json()
        assert body["income"] == 100000
        assert body["expense"] == 50000
        assert body["balance"] == 50000
        assert body["by_date"]["2026-06-01"] == {"income": 100000, "expense": 30000}
    finally:
        app.dependency_overrides.clear()


def test_create_transaction_persists_summary(client, app, make_user, monkeypatch):
    _override_auth(app, make_user)
    captured = {}

    class Cap:
        def table(self, _):
            return self
        def insert(self, payload):
            captured.update(payload)
            return self
        def execute(self):
            return type("R", (), {"data": [{**captured, "id": "new"}]})()

    monkeypatch.setattr(tx_router, "get_user_client", lambda token: Cap())
    try:
        res = client.post(
            "/api/transactions",
            json={
                "type": "expense",
                "amount": 8000,
                "transaction_date": "2026-06-06",
                "summary": "점심",
                "description": "여러 줄\n메모",
            },
        )
        assert res.status_code == 201
        assert captured["summary"] == "점심"
        assert captured["description"] == "여러 줄\n메모"
    finally:
        app.dependency_overrides.clear()


def test_summary_suggestions_distinct_recent(client, app, make_user, fake_client_factory, monkeypatch):
    _override_auth(app, make_user)
    rows = [
        {"summary": "점심", "created_at": "2026-06-03"},
        {"summary": "월급", "created_at": "2026-06-02"},
        {"summary": "점심", "created_at": "2026-06-01"},  # 중복 -> 1회만
        {"summary": "   ", "created_at": "2026-06-01"},   # 공백 제외
        {"summary": None, "created_at": "2026-06-01"},    # null 제외
    ]
    monkeypatch.setattr(
        tx_router, "get_user_client", lambda token: fake_client_factory({"transactions": rows})
    )
    try:
        res = client.get("/api/transactions/summaries")
        assert res.status_code == 200
        assert res.json() == ["점심", "월급"]
    finally:
        app.dependency_overrides.clear()


def test_delete_not_found_returns_404(client, app, make_user, fake_client_factory, monkeypatch):
    _override_auth(app, make_user)
    # RLS 로 본인 데이터가 아니면 delete 결과 data 가 빈 리스트 -> 404
    monkeypatch.setattr(
        tx_router, "get_user_client", lambda token: fake_client_factory(default=[])
    )
    try:
        res = client.delete("/api/transactions/does-not-exist")
        assert res.status_code == 404
    finally:
        app.dependency_overrides.clear()
