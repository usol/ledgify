"""공유 가계부 FastAPI 진입점."""
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import accounts, auth, cards, categories, transactions, users

load_dotenv()

app = FastAPI(title="공유 가계부 API", version="1.0.0")

# CORS : 프론트엔드(Vercel) 도메인 허용
# 콤마로 구분된 origin 목록을 환경변수로 받는다. 미지정 시 전체 허용(개발용).
_origins = os.environ.get("CORS_ORIGINS", "*")
allow_origins = ["*"] if _origins.strip() == "*" else [o.strip() for o in _origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(accounts.router)
app.include_router(cards.router)
app.include_router(categories.router)
app.include_router(transactions.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "budget-app api"}


@app.get("/health")
def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
