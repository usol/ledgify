"""거래 내역 CRUD + 월별 요약."""
from __future__ import annotations

import calendar
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import get_user_client
from middleware import CurrentUser, get_current_user
from models import TransactionCreate, TransactionUpdate

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("")
def list_transactions(
    user: CurrentUser = Depends(get_current_user),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    user_id: Optional[str] = Query(None),
):
    db = get_user_client(user.token)
    q = db.table("transactions").select("*")

    if year and month:
        last_day = calendar.monthrange(year, month)[1]
        start = date(year, month, 1).isoformat()
        end = date(year, month, last_day).isoformat()
        q = q.gte("transaction_date", start).lte("transaction_date", end)

    if user_id:
        q = q.eq("user_id", user_id)

    res = q.order("transaction_date", desc=True).order("created_at", desc=True).execute()
    return res.data


@router.get("/summary")
def summary(
    user: CurrentUser = Depends(get_current_user),
    year: int = Query(...),
    month: int = Query(...),
    user_id: Optional[str] = Query(None),
):
    db = get_user_client(user.token)
    last_day = calendar.monthrange(year, month)[1]
    start = date(year, month, 1).isoformat()
    end = date(year, month, last_day).isoformat()

    q = (
        db.table("transactions")
        .select("type, amount, transaction_date")
        .gte("transaction_date", start)
        .lte("transaction_date", end)
    )
    if user_id:
        q = q.eq("user_id", user_id)

    rows = q.execute().data or []

    income = sum(r["amount"] for r in rows if r["type"] == "income")
    expense = sum(r["amount"] for r in rows if r["type"] == "expense")

    # 날짜별 집계 (캘린더용)
    by_date: dict[str, dict[str, int]] = {}
    for r in rows:
        d = r["transaction_date"]
        bucket = by_date.setdefault(d, {"income": 0, "expense": 0})
        bucket[r["type"]] += r["amount"]

    return {
        "year": year,
        "month": month,
        "income": income,
        "expense": expense,
        "balance": income - expense,
        "by_date": by_date,
    }


@router.post("", status_code=201)
def create_transaction(
    body: TransactionCreate, user: CurrentUser = Depends(get_current_user)
):
    db = get_user_client(user.token)
    payload = body.model_dump(mode="json")
    payload["user_id"] = user.id
    res = db.table("transactions").insert(payload).execute()
    return res.data[0]


@router.patch("/{tx_id}")
def update_transaction(
    tx_id: str, body: TransactionUpdate, user: CurrentUser = Depends(get_current_user)
):
    db = get_user_client(user.token)
    # exclude_unset: 클라이언트가 실제로 보낸 필드만 반영 (null 로 비우기 허용)
    payload = body.model_dump(mode="json", exclude_unset=True)
    if not payload:
        raise HTTPException(status_code=400, detail="수정할 내용이 없습니다.")
    res = db.table("transactions").update(payload).eq("id", tx_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="거래를 찾을 수 없거나 권한이 없습니다.")
    return res.data[0]


@router.delete("/{tx_id}")
def delete_transaction(tx_id: str, user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)
    res = db.table("transactions").delete().eq("id", tx_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="거래를 찾을 수 없거나 권한이 없습니다.")
    return {"message": "삭제되었습니다."}
