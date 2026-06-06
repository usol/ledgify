"""테스트 공통 픽스처.

핵심: database.py 가 import 시점에 os.environ[...] 를 읽으므로,
앱을 import 하기 *전에* 더미 환경변수를 세팅해야 한다. 이 파일은
다른 어떤 백엔드 모듈보다 먼저 실행되므로 여기서 환경을 준비한다.

실제 Supabase 에는 접속하지 않는다. supabase 클라이언트 호출은
FakeClient 로 대체하거나 의존성 오버라이드로 우회한다.
"""
import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

# backend 디렉터리를 import 경로에 추가
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# ---- 앱 import 전에 더미 환경변수 주입 ----
# supabase-js 클라이언트는 키가 JWT 형식(a.b.c)인지 정규식으로 검증하므로
# 더미 키도 JWT 모양을 갖춰야 import 가 통과한다 (실제 네트워크 호출은 없음).
_DUMMY_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoidGVzdCJ9.c2lnbmF0dXJl"
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", _DUMMY_JWT)
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", _DUMMY_JWT)
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")


# =====================================================================
# Supabase PostgREST 쿼리 빌더를 흉내내는 체이너블 Fake
# =====================================================================
class FakeQuery:
    """select/insert/update/delete/eq/... 모두 self 를 반환하고
    execute() 에서 미리 지정한 data 를 돌려준다."""

    def __init__(self, data):
        self._data = data

    def _ret(self, *args, **kwargs):
        return self

    # 체이닝 메서드들
    select = insert = update = delete = _ret
    eq = neq = gte = lte = gt = lt = order = limit = single = _ret

    def execute(self):
        return SimpleNamespace(data=self._data)


class FakeClient:
    """table(name) -> FakeQuery. name 별로 다른 data 를 줄 수 있다."""

    def __init__(self, data_by_table=None, default=None):
        self._data_by_table = data_by_table or {}
        self._default = default if default is not None else []

    def table(self, name):
        return FakeQuery(self._data_by_table.get(name, self._default))


@pytest.fixture
def fake_client_factory():
    """테스트에서 원하는 데이터로 FakeClient 를 만들기 위한 팩토리."""
    def _make(data_by_table=None, default=None):
        return FakeClient(data_by_table=data_by_table, default=default)
    return _make


# =====================================================================
# 앱 / 의존성
# =====================================================================
@pytest.fixture
def app():
    import main
    return main.app


@pytest.fixture
def client(app):
    from fastapi.testclient import TestClient
    return TestClient(app)


@pytest.fixture
def make_user():
    """CurrentUser 인스턴스 생성 헬퍼."""
    from middleware import CurrentUser

    def _make(role="member", uid="user-1", name="홍길동"):
        return CurrentUser(id=uid, email=f"{uid}@test.com", name=name, role=role, token="tok")

    return _make
