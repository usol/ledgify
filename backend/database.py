"""Supabase 클라이언트 초기화.

- supabase            : anon key 기반 (RLS 적용, 일반 요청용)
- supabase_admin      : service_role key 기반 (RLS 우회, 구성원 생성/삭제용)
- get_user_client(jwt): 요청자 JWT 를 실은 클라이언트 (RLS 가 요청자 기준으로 동작)
"""
import os
from functools import lru_cache

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]


@lru_cache
def get_anon_client() -> Client:
    """anon key 클라이언트 (싱글톤)."""
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


@lru_cache
def get_admin_client() -> Client:
    """service_role 클라이언트 (싱글톤). RLS 를 우회하므로 신중히 사용."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_user_client(access_token: str) -> Client:
    """요청자 JWT 를 PostgREST 요청 헤더에 실어 RLS 가 요청자 기준으로 적용되게 한다."""
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    client.postgrest.auth(access_token)
    return client


# 편의용 모듈 레벨 인스턴스
supabase: Client = get_anon_client()
supabase_admin: Client = get_admin_client()
