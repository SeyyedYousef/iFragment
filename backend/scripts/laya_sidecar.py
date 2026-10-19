#!/usr/bin/env python3
"""
Laya System 1 Quantitative Decision Sidecar for iFragment
Analyzes structural, phonetic, combinatoric, and trait-rarity features from `req.state`
across Telegram Usernames, +888 Anonymous Numbers, and Telegram Gifts.
Exposes a high-performance HTTP server on http://127.0.0.1:8000/v1/systemone
"""

import hashlib
import math
import re
import sys
import time
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional

try:
    from pydantic import BaseModel
except ImportError:
    class BaseModel:  # Zero-dependency fallback for python:3.11-alpine
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def dict(self):
            out = {}
            for k, v in self.__dict__.items():
                if hasattr(v, "dict"):
                    out[k] = v.dict()
                elif isinstance(v, dict):
                    out[k] = {dk: (dv.dict() if hasattr(dv, "dict") else dv) for dk, dv in v.items()}
                else:
                    out[k] = v
            return out

try:
    from fastapi import FastAPI
    import uvicorn
except ImportError:
    FastAPI = None
    uvicorn = None

app = FastAPI(title="Laya System 1 Quantitative Decision Engine", version="2.0.0") if FastAPI else None


class Question(BaseModel):
    type: str  # choice, score, noul
    instructions: Optional[str] = None
    criteria: Optional[Dict[str, str]] = None
    scale: Optional[list] = None


class EvaluateRequest(BaseModel):
    model: Optional[str] = "convai/laya-multilingual"
    state: Dict[str, Any]
    questions: Dict[str, Question]


class Answer(BaseModel):
    type: str
    choice: Optional[str] = None
    score: Optional[int] = None
    noul: Optional[float] = None
    confidence: float
    probabilities: Optional[Dict[str, float]] = None


class Usage(BaseModel):
    input_tokens: int
    output_tokens: int


class EvaluateResponse(BaseModel):
    model: str
    latency_ms: float
    answers: Dict[str, Answer]
    usage: Usage


VOWELS = set("aeiou")
BRANDS = {
    "telegram", "durov", "wallet", "fragment", "toncoin", "bitcoin", "ethereum",
    "binance", "coinbase", "apple", "google", "meta", "microsoft", "openai",
    "nvidia", "amazon", "tesla", "nike", "adidas", "rolex", "gucci", "ferrari",
}
CRYPTO_KEYWORDS = {
    "crypto", "ton", "swap", "dex", "defi", "coin", "token", "nft", "web3", "whale", "hodl", "pepe", "btc", "eth", "sol",
}
LUXURY_KEYWORDS = {
    "gold", "rare", "vip", "king", "royal", "elite", "luxury", "diamond", "prime", "apex", "alpha", "crown",
}
BUSINESS_KEYWORDS = {
    "pay", "bank", "cash", "fund", "trade", "market", "club", "news", "auto", "ai", "bot", "app", "cloud", "tech",
}


def compute_phonetic_quality(handle: str) -> float:
    clean = re.sub(r"^@", "", str(handle).lower().strip())
    if not clean:
        return 0.65
    alpha = re.sub(r"[^a-z]", "", clean)
    if not alpha:
        return 0.45
    transitions = 0
    for i in range(1, len(alpha)):
        if (alpha[i] in VOWELS) != (alpha[i - 1] in VOWELS):
            transitions += 1
    cv_ratio = transitions / max(1, len(alpha) - 1)
    length_bonus = 1.0 if len(clean) <= 4 else (0.85 if len(clean) == 5 else (0.72 if len(clean) <= 7 else 0.48))
    penalty = 0.25 if ("_" in clean or any(ch.isdigit() for ch in clean)) else 0.0
    return max(0.12, min(0.99, (0.55 * cv_ratio + 0.45 * length_bonus) - penalty))


def compute_number_signals(raw_number: str) -> Dict[str, float]:
    digits = re.sub(r"\D", "", str(raw_number or ""))
    suffix = digits[3:] if digits.startswith("888") and len(digits) > 3 else digits
    if not suffix:
        return {"scarcity": 0.55, "cn": 0.60, "ru": 0.60, "mena": 0.60}

    n = len(suffix)
    distinct = len(set(suffix))
    is_pal = 1.0 if suffix == suffix[::-1] else 0.0

    # Max consecutive run
    max_run = 1
    cur_run = 1
    for i in range(1, n):
        if suffix[i] == suffix[i - 1]:
            cur_run += 1
            max_run = max(max_run, cur_run)
        else:
            cur_run = 1

    # Chinese numerology: 8 (+), 6 (+), 9 (+), 4 (-)
    eights = suffix.count("8")
    sixes = suffix.count("6")
    nines = suffix.count("9")
    fours = suffix.count("4")
    cn_score = 0.52 + (eights * 0.09) + (sixes * 0.05) + (nines * 0.04) - (fours * 0.10) + (max_run - 1) * 0.05
    cn_score = max(0.15, min(0.99, cn_score))

    # Russian/CIS prestige: repeating triples/quads, mirror ABBA, low distinct digits
    ru_score = 0.48 + (max_run >= 3) * 0.22 + is_pal * 0.18 + max(0, 6 - distinct) * 0.07
    ru_score = max(0.18, min(0.99, ru_score))

    # MENA/Persian VIP prestige: trailing/repeating zeros, 7s, 5s, 8s, long runs
    zeros = suffix.count("0")
    sevens = suffix.count("7")
    mena_score = 0.50 + (max_run - 1) * 0.09 + zeros * 0.05 + sevens * 0.04 + is_pal * 0.12
    mena_score = max(0.18, min(0.99, mena_score))

    scarcity = max(0.15, min(0.99, (9 - distinct) * 0.10 + (max_run - 1) * 0.08 + is_pal * 0.16))
    return {"scarcity": scarcity, "cn": cn_score, "ru": ru_score, "mena": mena_score}


def compute_state_signal_vector(state: Dict[str, Any]) -> Dict[str, float]:
    username = str(state.get("username") or state.get("handle") or "").lower().lstrip("@")
    raw_num = str(state.get("digits") or state.get("number") or "")
    backdrop = str(state.get("backdrop") or "").lower()
    model_name = str(state.get("model") or state.get("model_name") or state.get("collection") or "").lower()
    symbol = str(state.get("symbol") or "").lower()
    serial = int(state.get("serial_number") or state.get("serial") or 500)

    phonetic = compute_phonetic_quality(username) if username else 0.68
    is_crypto = 1.0 if any(k in username for k in CRYPTO_KEYWORDS) else 0.0
    is_luxury = 1.0 if any(k in username for k in LUXURY_KEYWORDS) else 0.0
    is_biz = 1.0 if any(k in username for k in BUSINESS_KEYWORDS) else 0.0
    is_kw = max(is_crypto, is_luxury, is_biz)
    is_tm = 1.0 if any(b == username or (len(b) >= 5 and b in username) for b in BRANDS) else 0.0

    num_sigs = compute_number_signals(raw_num)

    gift_synergy = 0.62
    if backdrop or model_name:
        if any(c in backdrop for c in ("black", "obsidian", "gold", "emerald", "cyber", "neon", "celestial")):
            gift_synergy += 0.20
        if any(s in symbol for s in ("crown", "diamond", "star", "fire", "ton", "pepe")):
            gift_synergy += 0.10
        if serial <= 10:
            gift_synergy += 0.12
        elif serial <= 100:
            gift_synergy += 0.06
        gift_synergy = max(0.20, min(0.98, gift_synergy))

    composite = max(0.15, min(0.98, 0.40 * phonetic + 0.20 * is_kw + 0.20 * num_sigs["scarcity"] + 0.20 * gift_synergy))
    return {
        "phonetic": phonetic,
        "keyword": is_kw,
        "is_crypto": is_crypto,
        "is_luxury": is_luxury,
        "is_biz": is_biz,
        "trademark": is_tm,
        "number_scarcity": num_sigs["scarcity"],
        "cn": num_sigs["cn"],
        "ru": num_sigs["ru"],
        "mena": num_sigs["mena"],
        "gift_synergy": gift_synergy,
        "serial": float(serial),
        "composite": composite,
    }


def select_semantic_choice(q_key: str, criteria: Dict[str, str], vec: Dict[str, float], state: Dict[str, Any]) -> Answer:
    keys = list(criteria.keys()) if criteria else ["standard"]
    ql = q_key.lower()
    username = str(state.get("username") or "").lower().lstrip("@")

    chosen = keys[0]
    if "trademark" in ql:
        if vec["trademark"] >= 0.85 and "direct_infringement" in criteria:
            chosen = "direct_infringement"
        elif vec["trademark"] >= 0.50 and "confusing_impersonation" in criteria:
            chosen = "confusing_impersonation"
        elif vec["keyword"] >= 0.50 and "descriptive_fair_use" in criteria:
            chosen = "descriptive_fair_use"
        elif "safe" in criteria:
            chosen = "safe"
    elif "cultural_resonance" in ql:
        if vec["is_crypto"] >= 0.5 and "web3_crypto" in criteria:
            chosen = "web3_crypto"
        elif vec["is_luxury"] >= 0.5 and "luxury_status" in criteria:
            chosen = "luxury_status"
        elif vec["is_biz"] >= 0.5 and "business_utility" in criteria:
            chosen = "business_utility"
        elif vec["phonetic"] >= 0.65 and "generic_english" in criteria:
            chosen = "generic_english"
        elif "obscure_filler" in criteria and vec["phonetic"] < 0.40:
            chosen = "obscure_filler"
    elif "target_entity_fit" in ql:
        if username.endswith("bot") and "automated_bot" in criteria:
            chosen = "automated_bot"
        elif vec["is_crypto"] >= 0.5 and "web3_project" in criteria:
            chosen = "web3_project"
        elif vec["is_luxury"] >= 0.5 and "personal_vip" in criteria:
            chosen = "personal_vip"
        elif vec["is_biz"] >= 0.5 and "web2_enterprise" in criteria:
            chosen = "web2_enterprise"
        elif "official_channel" in criteria:
            chosen = "official_channel"
    elif "liquidity" in ql:
        sig = max(vec["composite"], vec["number_scarcity"], vec["gift_synergy"])
        for pref in (
            ["instant_frenzy", "instant_liquid", "ultra_liquid"] if sig >= 0.82 else
            ["high_velocity", "active_trade", "high_turnover"] if sig >= 0.62 else
            ["moderate_liquidity", "medium_hold", "slow_liquid"]
        ):
            if pref in criteria:
                chosen = pref
                break
    elif "collector_prestige" in ql:
        if vec["number_scarcity"] >= 0.85 and "grail_monodigit" in criteria:
            chosen = "grail_monodigit"
        elif vec["number_scarcity"] >= 0.68 and "high_status" in criteria:
            chosen = "high_status"
        elif vec["number_scarcity"] >= 0.45 and "vanity_lifestyle" in criteria:
            chosen = "vanity_lifestyle"
        elif "standard" in criteria:
            chosen = "standard"
    elif "collector_appeal" in ql:
        if (vec["gift_synergy"] >= 0.85 or vec["serial"] <= 25) and "museum_grail" in criteria:
            chosen = "museum_grail"
        elif vec["gift_synergy"] >= 0.65 and "aesthetic_elite" in criteria:
            chosen = "aesthetic_elite"
        elif "floor_sweeper" in criteria:
            chosen = "floor_sweeper"
    elif "action_recommendation" in ql:
        if vec["gift_synergy"] >= 0.72 and "HOLD" in criteria:
            chosen = "HOLD"
        elif vec["gift_synergy"] < 0.45 and "CRAFT_FORGE" in criteria:
            chosen = "CRAFT_FORGE"
        elif "HOLD" in criteria:
            chosen = "HOLD"
    elif "buyer_archetype" in ql:
        for cand in ("ton_whale", "crypto_whale", "project_founder", "prestige_businessman", "collector_investor"):
            if cand in criteria:
                chosen = cand
                break

    probs: Dict[str, float] = {}
    rem = round(1.0 - 0.76, 4)
    other_cnt = max(1, len(keys) - 1)
    for k in keys:
        probs[k] = 0.76 if k == chosen else round(rem / other_cnt, 4)

    return Answer(type="choice", choice=chosen, confidence=0.92, probabilities=probs)


def evaluate_request(req: EvaluateRequest) -> EvaluateResponse:
    t0 = time.time()
    vec = compute_state_signal_vector(req.state)
    answers: Dict[str, Answer] = {}

    for q_key, q in req.questions.items():
        ql = q_key.lower()
        inst = (q.instructions or "").lower()

        if "cn" in ql or "chinese" in inst:
            sig = vec["cn"]
        elif "ru" in ql or "russian" in inst:
            sig = vec["ru"]
        elif "mena" in ql or "persian" in inst or "arab" in inst:
            sig = vec["mena"]
        elif "phonetic" in ql or "flow" in ql:
            sig = vec["phonetic"]
        elif "trademark" in ql or "seizure" in ql or "wash_trade" in ql or "anomaly" in ql:
            sig = vec["trademark"] if "trademark" in ql or "seizure" in ql else 0.05
        elif "synergy" in ql or "harmony" in ql:
            sig = vec["gift_synergy"]
        elif "number" in ql or "pattern" in ql or "aesthetics" in ql:
            sig = vec["number_scarcity"]
        elif "commercial" in ql or "bidding_war" in ql:
            sig = max(vec["composite"], 0.65 * vec["phonetic"] + 0.35 * vec["keyword"])
        else:
            digest = hashlib.sha256(f"{q_key}:{sorted(req.state.items())}".encode()).digest()
            jitter = ((digest[0] / 255.0) - 0.5) * 0.12
            sig = max(0.08, min(0.98, vec["composite"] + jitter))

        conf = round(max(0.78, min(0.98, 0.82 + 0.16 * abs(sig - 0.5))), 2)

        if q.type == "score":
            is_100_scale = any(tok in inst for tok in ("1 to 100", "1-100", "0 to 100", "0-100", "100"))
            if is_100_scale:
                score_val = max(1, min(100, int(round(1 + sig * 99))))
            else:
                score_val = max(1, min(10, int(round(1 + sig * 9))))
            answers[q_key] = Answer(type="score", score=score_val, confidence=conf)
        elif q.type == "noul":
            answers[q_key] = Answer(type="noul", noul=round(sig, 4), confidence=conf)
        elif q.type == "choice":
            answers[q_key] = select_semantic_choice(q_key, q.criteria or {}, vec, req.state)

    latency = (time.time() - t0) * 1000.0
    state_str = str(req.state)
    return EvaluateResponse(
        model=req.model or "convai/laya-multilingual",
        latency_ms=round(latency, 2),
        answers=answers,
        usage=Usage(input_tokens=max(1, len(state_str) // 4), output_tokens=len(answers) * 6),
    )


if app is not None:
    @app.get("/health")
    def health():
        return {"status": "ok", "engine": "laya-system-1-quantitative", "version": "2.0.0", "runtime": "ready"}

    @app.post("/v1/systemone", response_model=EvaluateResponse)
    def evaluate(req: EvaluateRequest):
        return evaluate_request(req)


class _StdlibLayaHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def _send_json(self, status_code: int, payload: dict):
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path.startswith("/health"):
            self._send_json(200, {"status": "ok", "engine": "laya-system-1-quantitative", "version": "2.0.0", "runtime": "stdlib-ready"})
        else:
            self._send_json(404, {"error": "not_found"})

    def do_POST(self):
        if not self.path.startswith("/v1/systemone"):
            self._send_json(404, {"error": "not_found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length).decode("utf-8")) if length > 0 else {}
            q_raw = body.get("questions") or {}
            q_objs = {}
            for qk, qv in q_raw.items():
                if isinstance(qv, dict):
                    q_objs[qk] = Question(
                        type=qv.get("type", "score"),
                        instructions=qv.get("instructions"),
                        criteria=qv.get("criteria"),
                        scale=qv.get("scale"),
                    )
            req = EvaluateRequest(
                model=body.get("model") or "convai/laya-multilingual",
                state=body.get("state") or {},
                questions=q_objs,
            )
            res = evaluate_request(req)
            out = res.model_dump() if hasattr(res, "model_dump") else res.dict()
            self._send_json(200, out)
        except Exception as exc:
            self._send_json(400, {"error": str(exc)})


if __name__ == "__main__":
    port = int(os.environ.get("LAYA_PORT", "8000"))
    print(f"🚀 Starting Laya System 1 Quantitative Sidecar v2.0 on http://0.0.0.0:{port}")
    if uvicorn is not None and app is not None:
        uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
    else:
        server = ThreadingHTTPServer(("0.0.0.0", port), _StdlibLayaHandler)
        server.serve_forever()
