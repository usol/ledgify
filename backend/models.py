"""Pydantic 요청/응답 모델."""
from __future__ import annotations

from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


# ----------------------------- Auth -----------------------------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserInfo(BaseModel):
    id: str
    email: Optional[str] = None
    name: str
    role: Literal["admin", "member"]


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    user: UserInfo


# ----------------------------- Users (구성원 관리) -----------------------------
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str


class UserUpdate(BaseModel):
    name: str


# ----------------------------- Accounts -----------------------------
class AccountCreate(BaseModel):
    name: str
    bank_name: Optional[str] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    bank_name: Optional[str] = None


# ----------------------------- Cards -----------------------------
class CardCreate(BaseModel):
    name: str
    account_id: Optional[str] = None
    card_type: Literal["credit", "debit"] = "credit"
    issuer: Optional[str] = None
    benefits: Optional[str] = None


class CardUpdate(BaseModel):
    name: Optional[str] = None
    account_id: Optional[str] = None
    card_type: Optional[Literal["credit", "debit"]] = None
    issuer: Optional[str] = None
    benefits: Optional[str] = None


# ----------------------------- Transactions -----------------------------
class TransactionCreate(BaseModel):
    type: Literal["income", "expense"]
    amount: int = Field(ge=0)
    transaction_date: date
    account_id: Optional[str] = None
    card_id: Optional[str] = None
    category: Optional[str] = None  # 레거시 텍스트 (하위호환)
    category_id: Optional[str] = None  # 카테고리(상위/하위) FK
    summary: Optional[str] = None  # 개요(짧은 제목, 자동완성 대상)
    description: Optional[str] = None  # 메모(여러 줄 가능)


class TransactionUpdate(BaseModel):
    type: Optional[Literal["income", "expense"]] = None
    amount: Optional[int] = Field(default=None, ge=0)
    transaction_date: Optional[date] = None
    account_id: Optional[str] = None
    card_id: Optional[str] = None
    category: Optional[str] = None
    category_id: Optional[str] = None
    summary: Optional[str] = None
    description: Optional[str] = None


# ----------------------------- Categories -----------------------------
class CategoryCreate(BaseModel):
    type: Literal["income", "expense"]
    name: str
    parent_id: Optional[str] = None  # null 이면 1-depth(상위), 값이 있으면 2-depth(하위)


class CategoryUpdate(BaseModel):
    name: str


# ----------------------------- 정렬(노출 순서) -----------------------------
class ReorderRequest(BaseModel):
    """정렬 대상 id 들을 노출 순서대로 담은 목록. index 가 곧 sort_order 가 된다."""
    ids: List[str]
