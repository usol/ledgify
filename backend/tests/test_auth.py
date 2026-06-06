"""인증 라우터 테스트 (Supabase 호출은 모킹)."""
from types import SimpleNamespace


def test_login_success(client, monkeypatch):
    import routers.auth as auth

    # get_anon_client().auth.sign_in_with_password(...) 모킹
    session = SimpleNamespace(access_token="acc-token", refresh_token="ref-token")
    user = SimpleNamespace(id="user-1", email="admin@test.com")
    fake_auth = SimpleNamespace(
        sign_in_with_password=lambda body: SimpleNamespace(session=session, user=user)
    )
    monkeypatch.setattr(auth, "get_anon_client", lambda: SimpleNamespace(auth=fake_auth))

    # profiles 조회용 supabase_admin 모킹
    class P:
        def table(self, _):
            return self
        def select(self, *a, **k):
            return self
        def eq(self, *a, **k):
            return self
        def single(self):
            return self
        def execute(self):
            return SimpleNamespace(data={"name": "관리자", "role": "admin"})

    monkeypatch.setattr(auth, "supabase_admin", P())

    res = client.post("/auth/login", json={"email": "admin@test.com", "password": "pw"})
    assert res.status_code == 200
    body = res.json()
    assert body["access_token"] == "acc-token"
    assert body["user"]["role"] == "admin"
    assert body["user"]["name"] == "관리자"


def test_login_invalid_credentials(client, monkeypatch):
    import routers.auth as auth

    def boom(body):
        raise Exception("invalid login")

    monkeypatch.setattr(
        auth, "get_anon_client", lambda: SimpleNamespace(auth=SimpleNamespace(sign_in_with_password=boom))
    )

    res = client.post("/auth/login", json={"email": "x@test.com", "password": "bad"})
    assert res.status_code == 401


def test_login_validation_error(client):
    # email 형식이 아니면 422
    res = client.post("/auth/login", json={"email": "not-an-email", "password": "pw"})
    assert res.status_code == 422


def test_me_requires_auth(client):
    # Authorization 헤더 없음 -> 401
    res = client.get("/auth/me")
    assert res.status_code == 401
