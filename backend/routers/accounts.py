"""계좌 CRUD. 읽기는 전체 공유, 쓰기는 본인 데이터(RLS 로 강제)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from database import get_user_client, supabase_admin
from middleware import CurrentUser, get_current_user
from models import AccountCreate, AccountUpdate, ReorderRequest

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("")
def list_accounts(user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)
    res = (
        db.table("accounts")
        .select("*")
        .order("sort_order")
        .order("created_at")
        .execute()
    )
    return res.data


@router.put("/order")
def reorder_accounts(body: ReorderRequest, _: CurrentUser = Depends(get_current_user)):
    """전체 공유 목록의 노출 순서를 일괄 변경. 다른 사용자 소유 행도 포함될 수 있어
    RLS 를 우회하는 service_role 로 처리한다(엔드포인트는 로그인으로 보호됨)."""
    for i, aid in enumerate(body.ids):
        supabase_admin.table("accounts").update({"sort_order": i}).eq("id", aid).execute()
    return {"message": "순서가 변경되었습니다."}


@router.post("", status_code=201)
def create_account(body: AccountCreate, user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)
    payload = body.model_dump()
    payload["user_id"] = user.id
    # 새 항목은 목록 맨 뒤로 (현재 최대 sort_order + 1)
    rows = db.table("accounts").select("sort_order").order("sort_order", desc=True).limit(1).execute().data
    payload["sort_order"] = (rows[0]["sort_order"] + 1) if rows else 0
    res = db.table("accounts").insert(payload).execute()
    return res.data[0]


@router.patch("/{account_id}")
def update_account(
    account_id: str, body: AccountUpdate, user: CurrentUser = Depends(get_current_user)
):
    db = get_user_client(user.token)
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    res = db.table("accounts").update(payload).eq("id", account_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없거나 권한이 없습니다.")
    return res.data[0]


@router.delete("/{account_id}")
def delete_account(account_id: str, user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)
    res = db.table("accounts").delete().eq("id", account_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없거나 권한이 없습니다.")
    return {"message": "삭제되었습니다."}
