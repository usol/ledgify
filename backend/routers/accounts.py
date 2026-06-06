"""계좌 CRUD. 읽기는 전체 공유, 쓰기는 본인 데이터(RLS 로 강제)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from database import get_user_client
from middleware import CurrentUser, get_current_user
from models import AccountCreate, AccountUpdate

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("")
def list_accounts(user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)
    res = db.table("accounts").select("*").order("created_at", desc=True).execute()
    return res.data


@router.post("", status_code=201)
def create_account(body: AccountCreate, user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)
    payload = body.model_dump()
    payload["user_id"] = user.id
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
