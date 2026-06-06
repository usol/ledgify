"""JWT 검증 의존성.

Supabase access_token(JWT) 을 검증한다. Supabase 는 프로젝트 설정에 따라
두 가지 서명 방식을 쓴다.
  - 비대칭 서명(ES256/RS256): JWKS 공개키로 검증 (현재 권장/기본)
  - 대칭 서명(HS256)        : 레거시 SUPABASE_JWT_SECRET 으로 검증

토큰 헤더의 alg 를 보고 둘 중 적절한 방식으로 검증한다. JWKS 는 kid 별로
캐시하며, 모르는 kid 가 오면 한 번 새로고침한다.
검증 성공 시 현재 사용자(profiles 포함) 정보를 반환하며, 실패 시 401.
관리자 전용 엔드포인트는 require_admin 의존성을 사용한다.
"""
from __future__ import annotations

import json
import urllib.request
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from database import SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, SUPABASE_URL, supabase_admin

bearer_scheme = HTTPBearer(auto_error=False)

_JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
_jwks_cache: dict[str, dict] = {}  # kid -> JWK


class CurrentUser:
    def __init__(self, id: str, email: Optional[str], name: str, role: str, token: str):
        self.id = id
        self.email = email
        self.name = name
        self.role = role
        self.token = token


def _fetch_jwks() -> None:
    """JWKS 를 받아 kid 별 캐시에 채운다."""
    req = urllib.request.Request(_JWKS_URL, headers={"apikey": SUPABASE_ANON_KEY})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    for key in data.get("keys", []):
        if key.get("kid"):
            _jwks_cache[key["kid"]] = key


def _get_jwk(kid: str) -> Optional[dict]:
    if kid not in _jwks_cache:
        _fetch_jwks()  # 모르는 kid -> 한 번 새로고침
    return _jwks_cache.get(kid)


def _decode_token(token: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")

        if alg == "HS256":
            # 레거시 대칭키 방식
            return jwt.decode(
                token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated"
            )

        # 비대칭(ES256/RS256): JWKS 공개키로 검증
        kid = header.get("kid")
        key = _get_jwk(kid) if kid else None
        if not key:
            raise HTTPException(status_code=401, detail="토큰 서명 키를 찾을 수 없습니다.")
        return jwt.decode(
            token, key, algorithms=[alg], audience="authenticated"
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"유효하지 않은 토큰입니다: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증 정보가 없습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = _decode_token(token)
    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id:
        raise HTTPException(status_code=401, detail="토큰에 사용자 정보가 없습니다.")

    # profiles 에서 name/role 조회 (service_role 로 안전하게)
    res = (
        supabase_admin.table("profiles")
        .select("name, role")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=403, detail="프로필이 존재하지 않습니다.")

    return CurrentUser(
        id=user_id,
        email=email,
        name=res.data["name"],
        role=res.data["role"],
        token=token,
    )


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    return user
