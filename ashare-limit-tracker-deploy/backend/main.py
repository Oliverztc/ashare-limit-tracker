from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

import akshare as ak
import pandas as pd
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST = BASE_DIR / "frontend_dist"

app = FastAPI(title="A股涨跌停追踪", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def pick(row: dict[str, Any], aliases: list[str], default: Any = None) -> Any:
    for key in aliases:
        if key in row and pd.notna(row[key]):
            return row[key]
    return default


def to_yyyymmdd(date_str: str) -> str:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").strftime("%Y%m%d")
    except ValueError:
        return datetime.now().strftime("%Y%m%d")


def to_market(code: str) -> str:
    code = str(code)
    if code.startswith(("600", "601", "603", "605", "688")):
        return "SH"
    if code.startswith(("000", "001", "002", "003", "300", "301")):
        return "SZ"
    if code.startswith(("4", "8")):
        return "BJ"
    return "SH"


def to_board(code: str, name: str) -> str:
    code = str(code)
    name = str(name or "")
    if "ST" in name.upper():
        return "ST"
    if code.startswith(("300", "301")):
        return "GEM"
    if code.startswith("688"):
        return "STAR"
    if code.startswith(("4", "8")):
        return "BSE"
    return "MAIN"


def to_eight_unit(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    try:
        v = float(value)
    except Exception:
        return 0.0

    if abs(v) >= 1_000_000:
        return round(v / 100000000, 2)
    return round(v, 2)


def parse_consecutive(value: Any) -> int:
    if value is None or value == "":
        return 1
    try:
        return int(value)
    except Exception:
        text = str(value)
        digits = "".join(ch for ch in text if ch.isdigit())
        return int(digits) if digits else 1


def norm_time(value: Any) -> str:
    if value is None or value == "":
        return "--:--:--"
    text = str(value).strip()
    if len(text) == 6 and text.isdigit():
        return f"{text[0:2]}:{text[2:4]}:{text[4:6]}"
    return text


def build_row(row: dict[str, Any], limit_type: str) -> dict[str, Any]:
    code = str(pick(row, ["代码", "code", "ts_code"], "")).split(".")[0]
    name = str(pick(row, ["名称", "name"], "未知"))
    price = float(pick(row, ["最新价", "price", "close"], 0) or 0)
    pct = float(pick(row, ["涨跌幅", "pct_chg"], 0) or 0)

    if price and pct != -100:
        pre_close = round(price / (1 + pct / 100), 2)
    else:
        pre_close = 0.0

    return {
        "code": code,
        "name": name,
        "board": to_board(code, name),
        "market": to_market(code),
        "industry": str(pick(row, ["所属行业", "industry"], "未分类")),
        "price": round(price, 2),
        "preClose": pre_close,
        "pctChg": round(pct, 3),
        "turnover": float(pick(row, ["换手率", "turnover_rate"], 0) or 0),
        "amount": to_eight_unit(pick(row, ["成交额", "turnover"], 0)),
        "volumeRatio": float(pick(row, ["量比", "volume_ratio"], 0) or 0),
        "sealAmount": to_eight_unit(
            pick(row, ["封板资金", "封单额", "limit_amount", "fd_amount"], 0)
        ),
        "consecutive": parse_consecutive(
            pick(row, ["连板数", "limit_times", "涨停统计", "up_stat"], 1)
        ),
        "limitType": limit_type,
        "firstLimitTime": norm_time(
            pick(row, ["首次封板时间", "first_time", "first_lu_time"], "--:--:--")
        ),
        "latestLimitTime": norm_time(
            pick(
                row,
                ["最后封板时间", "last_time", "last_lu_time", "last_ld_time"],
                "--:--:--",
            )
        ),
        "tag": str(pick(row, ["涨停标签", "tag"], "实时行情")),
        "reason": str(pick(row, ["涨停原因", "lu_desc", "所属题材"], "暂无说明")),
    }


def get_limit_up_pool(date_yyyymmdd: str) -> list[dict[str, Any]]:
    try:
        df = ak.stock_zt_pool_em(date=date_yyyymmdd)
        if df is None or df.empty:
            return []
        return [build_row(row, "UP") for row in df.to_dict(orient="records")]
    except Exception:
        return []


def get_limit_down_pool(date_yyyymmdd: str) -> list[dict[str, Any]]:
    try:
        df = ak.stock_zt_pool_dtgc_em(date=date_yyyymmdd)
        if df is None or df.empty:
            return []
        return [build_row(row, "DOWN") for row in df.to_dict(orient="records")]
    except Exception:
        return []


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/market/limits")
def market_limits(trade_date: str = Query(..., description="格式: YYYY-MM-DD")) -> dict[str, Any]:
    date_yyyymmdd = to_yyyymmdd(trade_date)
    up_rows = get_limit_up_pool(date_yyyymmdd)
    down_rows = get_limit_down_pool(date_yyyymmdd)

    data = up_rows + down_rows
    data.sort(
        key=lambda x: (
            0 if x["limitType"] == "UP" else 1,
            -x["consecutive"],
            -x["amount"],
        )
    )

    return {
        "trade_date": trade_date,
        "count": len(data),
        "data": data,
    }


if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    def serve_root() -> FileResponse:
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        requested = FRONTEND_DIST / full_path
        if requested.exists() and requested.is_file():
            return FileResponse(requested)
        return FileResponse(FRONTEND_DIST / "index.html")
