"""카테고리 CRUD (2-depth, 전역 공유, 모든 로그인 사용자 관리 가능).

카테고리는 user_id 가 없는 전역 데이터다. 삭제 시 해당 카테고리를 쓰는 거래는
다른 사용자 소유일 수 있으므로(공유 가계부), 이관/삭제는 RLS 를 우회하는
service_role(supabase_admin) 로 수행한다. (엔드포인트는 로그인으로 보호됨)
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import supabase_admin
from middleware import CurrentUser, get_current_user
from models import CategoryCreate, CategoryUpdate, ReorderRequest

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _name_taken(cat_type: str, parent_id: Optional[str], name: str, exclude_id: Optional[str] = None) -> bool:
    """같은 depth(동일 type + 동일 parent_id) 안에서 이름이 이미 쓰이는지.
    parent_id 가 다르면(상위가 다르면) 같은 이름이어도 중복이 아니다."""
    q = supabase_admin.table("categories").select("id").eq("type", cat_type).eq("name", name)
    q = q.eq("parent_id", parent_id) if parent_id else q.is_("parent_id", "null")
    rows = q.execute().data or []
    return any(r["id"] != exclude_id for r in rows)


@router.get("")
def list_categories(_: CurrentUser = Depends(get_current_user)):
    res = (
        supabase_admin.table("categories")
        .select("id, type, name, parent_id, sort_order, created_at")
        .order("type")
        .order("sort_order")
        .order("name")
        .execute()
    )
    return res.data


@router.put("/order")
def reorder_categories(body: ReorderRequest, _: CurrentUser = Depends(get_current_user)):
    """같은 그룹(상위끼리 / 한 부모의 하위끼리) 안에서의 노출 순서를 일괄 변경.
    프론트가 한 그룹의 id 들만 순서대로 보내고, index 가 sort_order 가 된다."""
    for i, cid in enumerate(body.ids):
        supabase_admin.table("categories").update({"sort_order": i}).eq("id", cid).execute()
    return {"message": "순서가 변경되었습니다."}


@router.post("", status_code=201)
def create_category(body: CategoryCreate, _: CurrentUser = Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="카테고리 이름을 입력하세요.")

    # 하위 카테고리면 부모를 검증하고, 부모의 type 을 따른다 (2-depth 제한)
    if body.parent_id:
        parent = (
            supabase_admin.table("categories")
            .select("id, type, parent_id")
            .eq("id", body.parent_id)
            .single()
            .execute()
        )
        if not parent.data:
            raise HTTPException(status_code=400, detail="상위 카테고리를 찾을 수 없습니다.")
        if parent.data["parent_id"] is not None:
            raise HTTPException(status_code=400, detail="2단계까지만 가능합니다 (하위의 하위는 만들 수 없음).")
        cat_type = parent.data["type"]
    else:
        cat_type = body.type

    if _name_taken(cat_type, body.parent_id, name):
        raise HTTPException(status_code=409, detail="같은 위치에 동일한 이름의 카테고리가 이미 있습니다.")

    # 새 카테고리는 같은 그룹(동일 type + parent_id)의 맨 뒤로
    sib = supabase_admin.table("categories").select("sort_order").eq("type", cat_type)
    sib = sib.eq("parent_id", body.parent_id) if body.parent_id else sib.is_("parent_id", "null")
    sib_rows = sib.order("sort_order", desc=True).limit(1).execute().data
    next_order = (sib_rows[0]["sort_order"] + 1) if sib_rows else 0

    res = (
        supabase_admin.table("categories")
        .insert({"type": cat_type, "name": name, "parent_id": body.parent_id, "sort_order": next_order})
        .execute()
    )
    return res.data[0]


@router.patch("/{cat_id}")
def update_category(cat_id: str, body: CategoryUpdate, _: CurrentUser = Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="카테고리 이름을 입력하세요.")

    cur = (
        supabase_admin.table("categories")
        .select("id, type, parent_id")
        .eq("id", cat_id)
        .single()
        .execute()
    )
    if not cur.data:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")

    if _name_taken(cur.data["type"], cur.data["parent_id"], name, exclude_id=cat_id):
        raise HTTPException(status_code=409, detail="같은 위치에 동일한 이름의 카테고리가 이미 있습니다.")

    res = supabase_admin.table("categories").update({"name": name}).eq("id", cat_id).execute()
    return res.data[0]


@router.delete("/{cat_id}")
def delete_category(
    cat_id: str,
    reassign_to: Optional[str] = Query(None),
    _: CurrentUser = Depends(get_current_user),
):
    db = supabase_admin

    exists = db.table("categories").select("id").eq("id", cat_id).execute().data
    if not exists:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")

    # 하위 카테고리가 있으면 삭제 차단
    children = db.table("categories").select("id").eq("parent_id", cat_id).execute().data
    if children:
        raise HTTPException(
            status_code=409,
            detail=f"하위 카테고리가 {len(children)}개 있습니다. 하위 카테고리를 먼저 삭제하거나 이동한 뒤 삭제하세요.",
        )

    # 이 카테고리를 사용하는 거래 수 (전체 사용자 기준)
    used = db.table("transactions").select("id").eq("category_id", cat_id).execute().data
    if used:
        if not reassign_to:
            # 프론트가 이관 대상을 고르도록 409 + 건수 반환
            raise HTTPException(
                status_code=409,
                detail=f"REASSIGN_REQUIRED:{len(used)}",
            )
        if reassign_to == cat_id:
            raise HTTPException(status_code=400, detail="같은 카테고리로는 이관할 수 없습니다.")
        target = db.table("categories").select("id").eq("id", reassign_to).execute().data
        if not target:
            raise HTTPException(status_code=400, detail="이관 대상 카테고리를 찾을 수 없습니다.")
        # 거래들을 이관 대상으로 일괄 변경
        db.table("transactions").update({"category_id": reassign_to}).eq(
            "category_id", cat_id
        ).execute()

    db.table("categories").delete().eq("id", cat_id).execute()
    return {"message": "삭제되었습니다.", "reassigned": len(used) if used else 0}
