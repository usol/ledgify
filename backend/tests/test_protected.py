"""인증/인가 가드 테스트: 비로그인 401, 비관리자 403."""


PROTECTED_GET = [
    "/api/accounts",
    "/api/cards",
    "/api/transactions",
    "/api/users",
]


def test_protected_endpoints_require_auth(client):
    for path in PROTECTED_GET:
        res = client.get(path)
        assert res.status_code == 401, f"{path} should be 401 without auth"


def test_summary_requires_auth(client):
    res = client.get("/api/transactions/summary", params={"year": 2026, "month": 6})
    assert res.status_code == 401


def test_member_cannot_access_users(client, app, make_user):
    """member 가 관리자 전용 /api/users 에 접근하면 403."""
    from middleware import get_current_user

    app.dependency_overrides[get_current_user] = lambda: make_user(role="member")
    try:
        res = client.get("/api/users")
        assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_health_is_public(client):
    assert client.get("/health").status_code == 200
    assert client.get("/").status_code == 200
