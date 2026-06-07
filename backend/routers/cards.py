"""카드 CRUD. 읽기는 전체 공유, 쓰기는 본인 데이터(RLS 로 강제)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from database import get_user_client, supabase_admin
from middleware import CurrentUser, get_current_user
from models import CardCreate, CardUpdate, ReorderRequest

router = APIRouter(prefix="/api/cards", tags=["cards"])


@router.get("")
def list_cards(user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)
    res = (
        db.table("cards")
        .select("*")
        .order("sort_order")
        .order("created_at")
        .execute()
    )
    return res.data


@router.put("/order")
def reorder_cards(body: ReorderRequest, _: CurrentUser = Depends(get_current_user)):
    """전체 공유 목록의 노출 순서를 일괄 변경(service_role 로 처리)."""
    for i, cid in enumerate(body.ids):
        supabase_admin.table("cards").update({"sort_order": i}).eq("id", cid).execute()
    return {"message": "순서가 변경되었습니다."}


@router.post("", status_code=201)
def create_card(body: CardCreate, user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)
    payload = body.model_dump()
    payload["user_id"] = user.id
    # 새 항목은 목록 맨 뒤로 (현재 최대 sort_order + 1)
    rows = db.table("cards").select("sort_order").order("sort_order", desc=True).limit(1).execute().data
    payload["sort_order"] = (rows[0]["sort_order"] + 1) if rows else 0
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
