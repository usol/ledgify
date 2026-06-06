# ledgify — 공유 가계부

여러 사용자가 **하나의 가계부를 공유**하는 웹 애플리케이션.
관리자가 구성원을 추가/관리하고, 모든 구성원이 같은 거래·계좌·카드 데이터를 함께 봅니다.

- **백엔드**: Python 3.11 + FastAPI
- **프론트엔드**: React 18 + Vite + TailwindCSS
- **DB / 인증**: Supabase (PostgreSQL + Auth)
- **배포**: 백엔드 → Railway, 프론트엔드 → Vercel

---

## 1. 디렉터리 구조

```
ledgify/
├── backend/                # FastAPI
│   ├── main.py             # 앱 진입점 + CORS
│   ├── middleware.py       # JWT 검증 의존성 (get_current_user / require_admin)
│   ├── database.py         # Supabase 클라이언트 (anon / service_role / user)
│   ├── models.py           # Pydantic 모델
│   ├── routers/
│   │   ├── auth.py         # /auth/login, /auth/logout, /auth/me
│   │   ├── users.py        # /api/users (관리자 전용 구성원 관리)
│   │   ├── accounts.py     # /api/accounts CRUD
│   │   ├── cards.py        # /api/cards CRUD
│   │   └── transactions.py # /api/transactions CRUD + summary
│   ├── requirements.txt
│   ├── Procfile / railway.json
│   └── .env.example
├── frontend/               # React + Vite
│   ├── src/
│   │   ├── pages/          # Login, Calendar, Transactions, Cards, Accounts, Settings
│   │   ├── components/     # Layout, PrivateRoute, AdminRoute, TransactionModal, CalendarGrid
│   │   ├── context/AuthContext.jsx
│   │   ├── api.js          # axios + 토큰 인터셉터
│   │   ├── supabaseClient.js
│   │   └── App.jsx
│   ├── package.json / vite.config.js
│   ├── tailwind.config.js / postcss.config.js
│   ├── vercel.json
│   └── .env.example
└── schema.sql              # 테이블 + RLS
```

---

## 2. Supabase 설정

1. [supabase.com](https://supabase.com) 에서 프로젝트 생성.
2. **SQL Editor** 에서 [`schema.sql`](./schema.sql) 전체 실행 → 테이블 + RLS 생성.
3. **최초 관리자 계정 생성**
   - Dashboard → **Authentication → Users → Add user** 로 관리자 이메일/비밀번호 생성 (Auto confirm 체크).
   - 생성된 유저의 **UUID** 복사.
   - SQL Editor 에서 아래 실행 (UUID 교체):
     ```sql
     insert into public.profiles (id, name, role)
     values ('붙여넣은-UUID', '관리자', 'admin')
     on conflict (id) do update set role = 'admin', name = excluded.name;
     ```
4. **API 키 확인**: Dashboard → Project Settings → API
   - `Project URL` → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon public` → `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (백엔드 전용, 절대 프론트에 노출 금지)
   - `JWT Secret` (Project Settings → API → JWT Settings) → `SUPABASE_JWT_SECRET`

---

## 3. 로컬 실행

### 백엔드
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # 값 채우기
uvicorn main:app --reload     # http://localhost:8000  (docs: /docs)
```

### 프론트엔드
```bash
cd frontend
npm install
cp .env.example .env          # 값 채우기 (VITE_API_BASE_URL=http://localhost:8000)
npm run dev                   # http://localhost:5173
```

생성한 관리자 계정으로 로그인 → **설정** 메뉴에서 구성원을 추가하세요.

---

## 4. 환경변수

### 백엔드 (Railway)
| 키 | 설명 |
|---|---|
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | anon public 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 (구성원 생성/삭제용) |
| `SUPABASE_JWT_SECRET` | 레거시(HS256) JWT 검증용 시크릿 |
| `CORS_ORIGINS` | 허용 도메인 (예: `https://your-app.vercel.app`). 미지정 시 `*` |

> **JWT 서명 방식**: 최신 Supabase 프로젝트는 access_token 을 비대칭키(ES256/RS256)로 서명합니다.
> 백엔드(`middleware.py`)는 토큰 헤더의 `alg` 를 보고 자동 분기합니다 — 비대칭이면 JWKS
> (`/auth/v1/.well-known/jwks.json`) 공개키로, 레거시 HS256 이면 `SUPABASE_JWT_SECRET` 으로 검증합니다.
> 따라서 두 방식 모두 별도 설정 없이 동작합니다.

### 프론트엔드 (Vercel)
| 키 | 설명 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | anon public 키 |
| `VITE_API_BASE_URL` | 배포된 백엔드 주소 (예: `https://xxx.up.railway.app`) |

---

## 5. 배포

### 백엔드 → Railway
1. Railway 에서 **New Project → Deploy from GitHub repo** 선택, 이 저장소 연결.
2. **Root Directory** 를 `backend` 로 설정.
3. 위 백엔드 환경변수 5개 등록 (`CORS_ORIGINS` 에는 Vercel 도메인).
4. 배포 후 생성된 도메인을 `VITE_API_BASE_URL` 로 사용.
   - 시작 명령은 `Procfile` / `railway.json` 에 정의됨 (`uvicorn main:app --host 0.0.0.0 --port $PORT`).

### 프론트엔드 → Vercel
1. Vercel 에서 **Add New → Project**, 이 저장소 import.
2. **Root Directory** 를 `frontend` 로 설정 (Framework: Vite 자동 감지).
3. 위 프론트엔드 환경변수 3개 등록.
4. Deploy. SPA 라우팅은 `vercel.json` 의 rewrite 로 처리됨.

> 배포 순서: 백엔드(Railway) 먼저 → 받은 URL 을 Vercel `VITE_API_BASE_URL` 에 넣고 프론트 배포 → 마지막으로 Railway `CORS_ORIGINS` 를 Vercel 도메인으로 갱신.

---

## 6. 권한 / 인증 개념

- 사용자 유형: **admin** / **member**. 최초 admin 1명은 Supabase Dashboard 에서 직접 생성.
- 관리자만 **설정** 페이지에서 구성원 추가/이름변경/삭제 가능. 본인(관리자) 계정은 삭제 불가.
- 로그인: 이메일 + 비밀번호 (Supabase Auth). 세션은 localStorage 에 유지(`supabase-js`).
- 비로그인 시 모든 페이지 → `/login` 리다이렉트 (`PrivateRoute`), `/settings` 는 관리자만(`AdminRoute`).
- **데이터 공유**: 모든 거래/계좌/카드는 전체 구성원이 **읽기** 공유. **수정/삭제는 본인 데이터만** (RLS + 백엔드가 요청자 JWT 로 강제).

---

## 7. 주요 API

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/auth/login` | 로그인 → access_token + user |
| POST | `/auth/logout` | 로그아웃 |
| GET | `/auth/me` | 현재 사용자 |
| GET/POST/PATCH/DELETE | `/api/users` `/api/users/{id}` | 구성원 관리 (관리자) |
| GET/POST/PATCH/DELETE | `/api/accounts` | 계좌 |
| GET/POST/PATCH/DELETE | `/api/cards` | 카드 |
| GET/POST/PATCH/DELETE | `/api/transactions` | 거래 |
| GET | `/api/transactions/summary?year=&month=&user_id=` | 월별 합계 + 날짜별 집계 |