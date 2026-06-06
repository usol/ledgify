"""카드 CRUD. 읽기는 전체 공유, 쓰기는 본인 데이터(RLS 로 강제)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from database import get_user_client
from middleware import CurrentUser, get_current_user
from models import CardCreate, CardUpdate

router = APIRouter(prefix="/api/cards", tags=["cards"])


@router.get("")
def list_cards(user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)
    res = db.table("cards").select("*").order("created_at", desc=True).execute()
    return res.data


@router.post("", status_code=201)
def create_card(body: CardCreate, user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)
    payload = body.model_dump()
    payload["user_id"] = user.id
    res = db.table("cards").insert(payload).execute()
    return res.data[0]


@router.patch("/{card_id}")
def update_card(
    card_id: str, body: CardUpdate, user: CurrentUser = Depends(get_current_user)
):
    db = get_user_client(user.token)
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    res = db.table("cards").update(payload).eq("id", card_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="카드를 찾을 수 없거나 권한이 없습니다.")
    return res.data[0]


@router.delete("/{card_id}")
def delete_card(card_id: str, user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)
    res = db.table("cards").delete().eq("id", card_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="카드를 찾을 수 없거나 권한이 없습니다.")
    return {"message": "삭제되었습니다."}
