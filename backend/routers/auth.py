"""인증: 로그인 / 로그아웃 / me."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from database import get_anon_client, supabase_admin
from middleware import CurrentUser, get_current_user
from models import LoginRequest, LoginResponse, UserInfo

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest):
    client = get_anon_client()
    try:
        res = client.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")

    if not res.session or not res.user:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")

    profile = (
        supabase_admin.table("profiles")
        .select("name, role")
        .eq("id", res.user.id)
        .single()
        .execute()
    )
    if not profile.data:
        raise HTTPException(status_code=403, detail="등록된 프로필이 없습니다. 관리자에게 문의하세요.")

    return LoginResponse(
        access_token=res.session.access_token,
        refresh_token=res.session.refresh_token,
        user=UserInfo(
            id=res.user.id,
            email=res.user.email,
            name=profile.data["name"],
            role=profile.data["role"],
        ),
    )


@router.post("/logout")
def logout(user: CurrentUser = Depends(get_current_user)):
    # 세션 무효화 (서버측). 프론트도 supabase.auth.signOut() 호출.
    try:
        supabase_admin.auth.admin.sign_out(user.token)
    except Exception:
        pass
    return {"message": "로그아웃되었습니다."}


@router.get("/me", response_model=UserInfo)
def me(user: CurrentUser = Depends(get_current_user)):
    return UserInfo(id=user.id, email=user.email, name=user.name, role=user.role)
