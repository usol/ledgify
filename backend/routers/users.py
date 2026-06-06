"""구성원 관리 (관리자 전용).

Supabase Admin API 로 auth.users 계정을 생성/삭제하고,
profiles 테이블을 함께 관리한다.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from database import supabase_admin
from middleware import CurrentUser, require_admin
from models import UserCreate, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
def list_users(_: CurrentUser = Depends(require_admin)):
    res = (
        supabase_admin.table("profiles")
        .select("id, name, role, created_at")
        .order("created_at")
        .execute()
    )
    return res.data


@router.post("", status_code=201)
def create_user(body: UserCreate, _: CurrentUser = Depends(require_admin)):
    # 1) auth.users 에 계정 생성 (이메일 인증 없이 바로 활성화)
    try:
        created = supabase_admin.auth.admin.create_user(
            {
                "email": body.email,
                "password": body.password,
                "email_confirm": True,
            }
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"계정 생성 실패: {exc}")

    new_user = created.user
    if not new_user:
        raise HTTPException(status_code=400, detail="계정 생성에 실패했습니다.")

    # 2) profiles 삽입 (role=member 고정)
    try:
        supabase_admin.table("profiles").insert(
            {"id": new_user.id, "name": body.name, "role": "member"}
        ).execute()
    except Exception as exc:
        # 프로필 생성 실패 시 방금 만든 auth 계정 롤백
        supabase_admin.auth.admin.delete_user(new_user.id)
        raise HTTPException(status_code=400, detail=f"프로필 생성 실패: {exc}")

    return {"id": new_user.id, "email": body.email, "name": body.name, "role": "member"}


@router.patch("/{user_id}")
def update_user(user_id: str, body: UserUpdate, _: CurrentUser = Depends(require_admin)):
    res = (
        supabase_admin.table("profiles")
        .update({"name": body.name})
        .eq("id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="해당 구성원을 찾을 수 없습니다.")
    return res.data[0]


@router.delete("/{user_id}")
def delete_user(user_id: str, admin: CurrentUser = Depends(require_admin)):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="본인(관리자) 계정은 삭제할 수 없습니다.")

    # auth.users 삭제 → profiles 는 on delete cascade 로 함께 삭제
    try:
        supabase_admin.auth.admin.delete_user(user_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"삭제 실패: {exc}")

    # 혹시 cascade 가 안 걸린 경우 대비
    supabase_admin.table("profiles").delete().eq("id", user_id).execute()
    return {"message": "삭제되었습니다."}
