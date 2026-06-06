"""구성원 관리(관리자 전용) 테스트."""
from types import SimpleNamespace

import routers.users as users_router
from middleware import get_current_user


def _admin(app, make_user, uid="admin-1"):
    user = make_user(role="admin", uid=uid, name="관리자")
    app.dependency_overrides[get_current_user] = lambda: user
    return user


def test_list_users(client, app, make_user, fake_client_factory, monkeypatch):
    _admin(app, make_user)
    data = [{"id": "u1", "name": "A", "role": "member", "created_at": "2026-01-01"}]
    monkeypatch.setattr(users_router, "supabase_admin", fake_client_factory({"profiles": data}))
    try:
        res = client.get("/api/users")
        assert res.status_code == 200
        assert res.json()[0]["name"] == "A"
    finally:
        app.dependency_overrides.clear()


def test_create_user_creates_auth_and_profile(client, app, make_user, monkeypatch):
    _admin(app, make_user)
    calls = {"created": None, "inserted": None}

    class FakeAdmin:
        # auth.admin.create_user
        auth = None

        def table(self, _):
            return self

        def insert(self, payload):
            calls["inserted"] = payload
            return self

        def execute(self):
            return SimpleNamespace(data=[calls["inserted"]])

    fake = FakeAdmin()

    def create_user(body):
        calls["created"] = body
        return SimpleNamespace(user=SimpleNamespace(id="new-uid", email=body["email"]))

    fake.auth = SimpleNamespace(admin=SimpleNamespace(create_user=create_user, delete_user=lambda i: None))
    monkeypatch.setattr(users_router, "supabase_admin", fake)

    try:
        res = client.post(
            "/api/users",
            json={"email": "new@test.com", "password": "secret1", "name": "신입"},
        )
        assert res.status_code == 201
        # auth 계정 생성 시 email_confirm=True 로 즉시 활성화
        assert calls["created"]["email_confirm"] is True
        # profiles 에는 role=member 고정
        assert calls["inserted"]["role"] == "member"
        assert calls["inserted"]["id"] == "new-uid"
    finally:
        app.dependency_overrides.clear()


def test_admin_cannot_delete_self(client, app, make_user, monkeypatch):
    admin = _admin(app, make_user, uid="admin-1")
    monkeypatch.setattr(users_router, "supabase_admin", SimpleNamespace())
    try:
        res = client.delete(f"/api/users/{admin.id}")
        assert res.status_code == 400
        assert "본인" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_delete_member_calls_admin_api(client, app, make_user, monkeypatch):
    _admin(app, make_user, uid="admin-1")
    deleted = {}

    class FakeAdmin:
        auth = SimpleNamespace(
            admin=SimpleNamespace(delete_user=lambda uid: deleted.update({"uid": uid}))
        )

        def table(self, _):
            return self
        def delete(self):
            return self
        def eq(self, *a, **k):
            return self
        def execute(self):
            return SimpleNamespace(data=[])

    monkeypatch.setattr(users_router, "supabase_admin", FakeAdmin())
    try:
        res = client.delete("/api/users/member-9")
        assert res.status_code == 200
        assert deleted["uid"] == "member-9"
    finally:
        app.dependency_overrides.clear()
