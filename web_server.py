"""
FPL Ghost web server — wires the Claude Design React prototype to the real FPL backend.

Serves:
  GET  /                       → FPL Ghost.html
  GET  /data.jsx               → dynamically generated with REAL FPL data
                                 (Pushkar's squad, Anuj's rival squad, Zweden PL league)
  GET  /*.jsx, /*.js           → static design files from design_reference/
  GET  /api/refresh            → force-clear 10-minute cache and re-fetch

Run:
  .venv/bin/python -m uvicorn web_server:app --reload --port 8000

Then open http://localhost:8000/
"""

from __future__ import annotations
from pathlib import Path
import json
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response, HTMLResponse
from fastapi.staticfiles import StaticFiles

import fpl_api
import xp_engine
from models import Player, Squad


app = FastAPI(title="FPL Ghost")

PROJECT_ROOT = Path(__file__).parent
DESIGN_DIR = PROJECT_ROOT / "design_reference"

# Pushkar + Anuj IDs (from memory); override with query params if desired.
DEFAULT_MANAGER_ID = 9364099
DEFAULT_RIVAL_ID = 646223
DEFAULT_LEAGUE_ID = 1141763  # Zweden PL
DEFAULT_HORIZON = 4


# ---------------------------------------------------------------------------
# In-memory state (reuses requests_cache inside fpl_api)
# ---------------------------------------------------------------------------

class _State:
    bootstrap = None
    players: list[Player] = []
    player_map: dict[int, Player] = {}
    current_gw: int = 1
    team_short: dict[int, str] = {}
    bank_m: float = 0.0
    free_transfers: int = 1
    transfers_used: int = 0
    transfer_cost: int = 0
    manager_name: str = ""
    overall_rank: int = 0
    deadline_label: str = ""
    next_gw: int = 1          # GW to show projections for in lineup

STATE = _State()


def _load() -> None:
    """Load FPL bootstrap + derive xP. Safe to call repeatedly (cached)."""
    if STATE.bootstrap is not None:
        return
    STATE.bootstrap = fpl_api.get_bootstrap()
    STATE.players = fpl_api.build_players(STATE.bootstrap)
    STATE.current_gw = fpl_api.get_current_gw(STATE.bootstrap)
    # Next GW from bootstrap events
    for ev in STATE.bootstrap["events"]:
        if ev.get("is_next"):
            STATE.next_gw = ev["id"]
            break
    else:
        STATE.next_gw = STATE.current_gw + 1

    # Fetch element-summary for user's 15 squad players for v2 xP model
    element_data: dict[int, "xp_engine.ElementData"] = {}
    try:
        picks_raw = fpl_api.get_entry_picks(DEFAULT_MANAGER_ID, STATE.current_gw)
        squad_ids = [p["element"] for p in picks_raw.get("picks", [])]
        raw_summaries = fpl_api.get_element_summaries_parallel(squad_ids)
        for pid, raw in raw_summaries.items():
            if raw:
                element_data[pid] = xp_engine.parse_element_data(pid, raw)
    except Exception:
        pass  # degrade gracefully — v1 model still runs

    xp_engine.enrich_players_with_xp(
        STATE.players,
        bootstrap=STATE.bootstrap,
        start_gw=STATE.current_gw,
        horizon_gws=DEFAULT_HORIZON,
        element_data=element_data or None,
    )
    STATE.player_map = {p.id: p for p in STATE.players}
    STATE.team_short = {t["id"]: t["short_name"] for t in STATE.bootstrap["teams"]}
    try:
        entry = fpl_api.get_entry(DEFAULT_MANAGER_ID)
        STATE.bank_m = entry.get("last_deadline_bank", 0) / 10.0
        STATE.manager_name = f"{entry.get('player_first_name','')} {entry.get('player_last_name','')}".strip()
        STATE.overall_rank = entry.get("summary_overall_rank", 0) or 0
    except Exception:
        STATE.bank_m = 0.0
    # Transfers used this GW + free-transfer rollover (2024/25 rules, cap 5)
    try:
        picks_data = fpl_api.get_entry_picks(DEFAULT_MANAGER_ID, STATE.current_gw)
        eh = picks_data.get("entry_history", {})
        STATE.transfers_used = eh.get("event_transfers", 0)
        STATE.transfer_cost = eh.get("event_transfers_cost", 0)
        hist = fpl_api.get_entry_history(DEFAULT_MANAGER_ID)
        rollover = 0
        for row in reversed(hist.get("current", [])):
            if row["event"] >= STATE.current_gw:
                continue
            if row["event_transfers"] == 0:
                rollover += 1
            else:
                break
        STATE.free_transfers = max(0, min(5, 1 + rollover - STATE.transfers_used))
    except Exception:
        STATE.transfers_used = 0
        STATE.free_transfers = 1
    # Deadline label for current GW
    from datetime import datetime
    for ev in STATE.bootstrap["events"]:
        if ev["id"] == STATE.current_gw:
            dl = ev.get("deadline_time")
            if dl:
                try:
                    dt = datetime.fromisoformat(dl.replace("Z", "+00:00"))
                    STATE.deadline_label = dt.strftime("%a %d %b").upper()
                except Exception:
                    STATE.deadline_label = ""
            break


# ---------------------------------------------------------------------------
# FPL → design-shape converter
# ---------------------------------------------------------------------------

# Design expects these 20 club codes; we map FPL short_name (which already matches)
_KNOWN_CLUBS = {
    "ARS", "AVL", "BOU", "BRE", "BHA", "BUR", "CHE", "CRY", "EVE", "FUL",
    "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT", "WHU", "WOL",
}


def _status_flag(player: Player) -> dict:
    """Return {status, news, chance, card?} matching design shape."""
    out = {"status": "a", "news": None}
    if player.status == "i":
        out["status"] = "i"
        out["news"] = player.news or "Injured"
    elif player.status == "s":
        out["status"] = "s"
        out["news"] = player.news or "Suspended"
    elif player.status == "u":
        out["status"] = "u"
        out["news"] = player.news or "Unavailable"
    elif player.status == "d":
        out["status"] = "d"
        out["chance"] = player.chance_next
        out["news"] = player.news or f"Doubt — {player.chance_next}%"
    if player.yellow_cards >= 4:
        out["card"] = {"yellows": player.yellow_cards, "risk": "high"}
    return out


def _fixture_flags(player: Player, start_gw: int) -> dict:
    """Detect DGW / BGW for this player in the immediate next GW."""
    fixtures_next = player.xP_by_gw.get(start_gw, None)
    # Heuristic via the xP matrix: if xP > expected single-match max, it's a DGW
    # Simpler: count fixtures directly via fpl_api
    import fixture_engine
    schedule = fixture_engine.build_team_schedule(
        STATE.bootstrap, start_gw, 1
    )
    gw_fixtures = [f for f in schedule.get(player.team_id, []) if f.gw == start_gw]
    flags = {}
    if len(gw_fixtures) >= 2:
        flags["dgw"] = True
    elif len(gw_fixtures) == 0:
        flags["bgw"] = True
    return flags


def _player_to_design_shape(
    player: Player,
    pick_idx: int,
    is_captain: bool,
    is_vice: bool,
    display_gw: int,
) -> dict:
    short = STATE.team_short.get(player.team_id, "???")
    if short not in _KNOWN_CLUBS:
        short = "ARS"
    last = player.web_name.upper()[:10]
    flags = _status_flag(player)
    fx_flags = _fixture_flags(player, display_gw)
    proj = player.xP_by_gw.get(display_gw, player.xP)
    # Build 5-GW xP array starting from display_gw
    xp_by_gw = [
        {"gw": display_gw + i, "xp": round(player.xP_by_gw.get(display_gw + i, 0.0), 2)}
        for i in range(5)
    ]
    return {
        "id": f"p{player.id}",
        "name": player.web_name,
        "last": last,
        "first": player.first_name,
        "club": short,
        "pos": player.position,
        "price": round(player.cost / 10.0, 1),
        "proj": round(proj, 2),
        "form": round(player.form, 1),
        "selected": round(player.selected_by_percent, 1),
        "captain": is_captain,
        "vice": is_vice,
        "startIdx": pick_idx,
        "xpByGw": xp_by_gw,
        "yellowCards": player.yellow_cards,
        **flags,
        **fx_flags,
    }


def _build_squad_json(manager_id: int) -> list[dict]:
    """Fetch a manager's current GW picks and return design-shape JSON."""
    picks_data = fpl_api.get_entry_picks(manager_id, STATE.current_gw)
    picks = picks_data.get("picks", [])

    squad = []
    for pick in picks:
        pid = pick["element"]
        player = STATE.player_map.get(pid)
        if not player:
            continue
        squad.append(_player_to_design_shape(
            player,
            pick_idx=pick["position"] - 1,
            is_captain=pick.get("is_captain", False),
            is_vice=pick.get("is_vice_captain", False),
            display_gw=STATE.next_gw,
        ))
    squad.sort(key=lambda p: p["startIdx"])
    return squad


def _build_league_json(league_id: int, me_id: int, rival_id: int) -> list[dict]:
    """Fetch mini-league standings and mark me/rival."""
    try:
        data = fpl_api.get_league_standings(league_id)
    except Exception:
        return []
    standings = data.get("standings", {}).get("results", [])
    rows = []
    for entry in standings:
        eid = entry["entry"]
        rows.append({
            "rank": entry["rank"],
            "prev": entry.get("last_rank", entry["rank"]),
            "manager": entry["player_name"],
            "team": entry["entry_name"],
            "total": entry["total"],
            "gw": entry.get("event_total", 0),
            "id": "me" if eid == me_id else ("rival" if eid == rival_id else f"u{eid}"),
            "isMe": eid == me_id,
        })
    return rows


def _build_my_leagues_json(manager_id: int) -> list[dict]:
    """Fetch all classic leagues for a manager."""
    try:
        entry = fpl_api._get(f"entry/{manager_id}/")
    except Exception:
        return []
    leagues = entry.get("leagues", {}).get("classic", [])
    out = []
    for lg in leagues:
        out.append({
            "id": f"lg_{lg['id']}",
            "fpl_id": lg["id"],
            "name": lg["name"],
            "code": None,
            "size": lg.get("rank_count", 0),
            "myRank": lg.get("entry_rank", 0),
            "prevRank": lg.get("entry_last_rank", lg.get("entry_rank", 0)),
            "active": lg["id"] == DEFAULT_LEAGUE_ID,
            "isGlobal": lg.get("league_type") == "s" and lg["id"] == 314,
        })
    return out


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
def index():
    html_path = DESIGN_DIR / "FPL Ghost.html"
    if not html_path.exists():
        raise HTTPException(500, "Design HTML not found")
    content = html_path.read_text()
    # Inject a small banner so users know data is live
    banner = """
    <div id="live-banner" style="position:fixed;bottom:12px;left:12px;z-index:9999;
         background:#5c7a4f;color:#fff;padding:6px 12px;border-radius:8px;
         font-family:Inter,sans-serif;font-size:11px;font-weight:500;
         box-shadow:0 4px 12px rgba(60,30,50,0.15)">
      ● LIVE — real FPL data (manager 9364099 vs 646223)
    </div>
    """
    content = content.replace("</body>", banner + "</body>")
    return HTMLResponse(content)


def _build_player_pool() -> list[dict]:
    """All 829 FPL players as player-pool objects for the Transfers view."""
    pos_names = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}
    out = []
    for p in sorted(STATE.players, key=lambda x: -x.xP):
        short = STATE.team_short.get(p.team_id, "ARS")
        if short not in _KNOWN_CLUBS:
            short = "ARS"
        out.append({
            "id": f"p{p.id}",
            "name": p.web_name,
            "last": p.web_name.upper()[:10],
            "first": p.first_name,
            "club": short,
            "pos": p.position,
            "price": round(p.cost / 10.0, 1),
            "proj": round(p.xP, 2),
            "form": round(p.form, 1),
            "selected": round(p.selected_by_percent, 1),
            "xGI": round(p.xgi_per_90, 2),
            "status": p.status if p.status in ("a", "i", "d", "s", "u") else "a",
            "news": p.news or None,
            "yellowCards": p.yellow_cards,
            "xpByGw": [
                {"gw": STATE.next_gw + i, "xp": round(p.xP_by_gw.get(STATE.next_gw + i, 0.0), 2)}
                for i in range(5)
            ],
        })
    return out


@app.get("/data.jsx")
def data_jsx(me: int = DEFAULT_MANAGER_ID, rival: int = DEFAULT_RIVAL_ID,
             league: int = DEFAULT_LEAGUE_ID):
    """Dynamic data.jsx with REAL FPL data. Falls back gracefully if API is unreachable."""
    try:
        _load()
    except Exception as exc:
        return Response(
            content=f"// FPL API unavailable: {exc}\n" + (DESIGN_DIR / "data.jsx").read_text(),
            media_type="application/javascript",
        )

    try:
        my_squad = _build_squad_json(me)
    except Exception:
        my_squad = []
    try:
        rival_squad = _build_squad_json(rival)
    except Exception:
        rival_squad = []
    try:
        mini_league = _build_league_json(league, me, rival)
    except Exception:
        mini_league = []
    try:
        my_leagues = _build_my_leagues_json(me)
    except Exception:
        my_leagues = []
    try:
        player_pool = _build_player_pool()
    except Exception:
        player_pool = []

    # Compute team-level means/stddevs for bell curves
    my_mean = round(sum(p["proj"] for p in my_squad[:11]) +
                    next((p["proj"] for p in my_squad if p.get("captain")), 0), 1) or 50.0
    rival_mean = round(sum(p["proj"] for p in rival_squad[:11]) +
                       next((p["proj"] for p in rival_squad if p.get("captain")), 0), 1) or 50.0

    # Build static data.jsx content (TEAMS, FIXTURES) from the original design file,
    # then replace only the dynamic blocks.
    static_src = (DESIGN_DIR / "data.jsx").read_text()

    # Cut out everything from "const MY_SQUAD =" onwards — we'll regenerate
    cut_idx = static_src.find("const MY_SQUAD")
    header = static_src[:cut_idx]

    dynamic = f"""
// ========================================================================
// LIVE FPL DATA — replaces mock placeholders
// Manager {me} (you) vs {rival} (rival), League {league}
// ========================================================================

const MY_SQUAD = {json.dumps(my_squad, indent=2)};
const RIVAL_SQUAD = {json.dumps(rival_squad, indent=2)};
const MINI_LEAGUE = {json.dumps(mini_league, indent=2)};
const MY_LEAGUES = {json.dumps(my_leagues, indent=2)};
const PLAYER_POOL = {json.dumps(player_pool, indent=2)};

// Planner timeline — next {DEFAULT_HORIZON} GWs starting from GW{STATE.current_gw}
const GW_TIMELINE = [
{",".join(
  f'  {{ gw: {STATE.current_gw + i}, proj: {my_mean * (0.9 + 0.05*i):.1f}, actual: null, ft: {max(1, 15-i)}, itb: {STATE.bank_m:.1f}, chip: null, active: {str(i==0).lower()} }}'
  for i in range(DEFAULT_HORIZON)
)}
];

const LIVE_MATCHES = [];  // intentionally empty — no live ticker for now

// Runtime state read by pitch.jsx / transfers.jsx / app.jsx
window.FPL_STATE = {{
  currentGw: {STATE.current_gw},
  nextGw: {STATE.next_gw},
  bank: {STATE.bank_m:.1f},
  freeTransfers: {STATE.free_transfers},
  transfersUsed: {STATE.transfers_used},
  transferCost: {STATE.transfer_cost},
  managerName: {json.dumps(STATE.manager_name)},
  overallRank: {STATE.overall_rank},
  deadline: {json.dumps(STATE.deadline_label)},
}};

const MY_DIST = {{ mean: {my_mean}, stddev: 15.2, p40: {my_mean + 4.5:.1f}, p60: {my_mean - 0.3:.1f}, p80: {my_mean - 15:.1f} }};
const RIVAL_DIST = {{ mean: {rival_mean}, stddev: 16.8, p40: {rival_mean + 4.5:.1f}, p60: {rival_mean - 0.8:.1f}, p80: {rival_mean - 16:.1f} }};

function generateDistribution(mean, stddev) {{
  const pts = [];
  for (let x = 0; x <= 150; x += 1) {{
    const y = Math.exp(-0.5 * Math.pow((x - mean) / stddev, 2)) / (stddev * Math.sqrt(2 * Math.PI));
    pts.push({{ x, y }});
  }}
  return pts;
}}

Object.assign(window, {{
  TEAMS, FIXTURES, MY_SQUAD, RIVAL_SQUAD, MINI_LEAGUE, MY_LEAGUES,
  GW_TIMELINE, LIVE_MATCHES, MY_DIST, RIVAL_DIST, generateDistribution, PLAYER_POOL,
}});
"""

    return Response(content=header + dynamic,
                    media_type="application/javascript")


@app.get("/api/refresh")
def refresh():
    """Clear the 10-min request cache and reset state — force-fetch on next render."""
    fpl_api.clear_cache()
    STATE.bootstrap = None
    STATE.players = []
    STATE.player_map = {}
    return {"ok": True}


@app.get("/api/entry/{entry_id}")
def api_entry(entry_id: int):
    """General team info (manager, kit, bank, value, leagues)."""
    return fpl_api.get_entry(entry_id)


@app.get("/api/entry/{entry_id}/transfers")
def api_entry_transfers(entry_id: int):
    """Season-long transfer history."""
    return fpl_api.get_entry_transfers(entry_id)


@app.get("/api/entry/{entry_id}/history")
def api_entry_history(entry_id: int):
    """Per-GW history and past seasons."""
    return fpl_api.get_entry_history(entry_id)


@app.get("/api/element/{element_id}")
def api_element(element_id: int):
    """Per-player fixtures (with FDR) + season-by-season history."""
    return fpl_api.get_element_summary(element_id)


@app.get("/api/fixtures")
def api_fixtures(event: Optional[int] = None):
    """All fixtures, or filtered to one gameweek with ?event=N."""
    return fpl_api.get_fixtures(event=event)


@app.get("/api/live/{gw}")
def api_live(gw: int):
    """Live points for every player in a given GW."""
    return fpl_api.get_live_gw(gw)


@app.get("/api/regions")
def api_regions():
    return fpl_api.get_regions()


@app.get("/api/best-leagues")
def api_best_leagues():
    return fpl_api.get_best_private_leagues()


@app.get("/api/summary")
def summary():
    """Quick JSON summary of the current state, useful for debugging."""
    _load()
    return {
        "current_gw": STATE.current_gw,
        "players_loaded": len(STATE.players),
        "default_manager": DEFAULT_MANAGER_ID,
        "default_rival": DEFAULT_RIVAL_ID,
        "default_league": DEFAULT_LEAGUE_ID,
        "bank_m": STATE.bank_m,
        "deadline": STATE.deadline_label,
    }


# Static files: jsx, js, uploads, etc.
# Per-file literal patches. Templates reference {bank}, {gw}, {gw_next4}, {deadline}.
_STATIC_PATCHES = {
    "app.jsx": [
        ("£0.5m", "£{bank:.1f}m"),
        ("BENCHMARK · GW1 · SAT 28 APR", "BENCHMARK · GW{next_gw} · {deadline}"),
        ("Projected points · GW1", "Projected points · GW{next_gw}"),
    ],
    "pitch.jsx": [
        ("£ 0.5", "£ {bank:.1f}"),
        ("title = 'GW1'", "title = 'GW{next_gw}'"),
    ],
    "transfers.jsx": [
        ("const itb = 0.5;", "const itb = {bank:.1f};"),
        ("1 FT · £0.5 ITB", "{ft} FT · £{bank:.1f} ITB"),
    ],
    "other-views.jsx": [
        ("12 managers · GW1 · Invite code", "12 managers · GW{next_gw} · Invite code"),
        ("GW1 projected", "GW{next_gw} projected"),
        ("GW1-5 projected", "GW{next_gw}-{gw_next4} projected"),
    ],
}


def _format_patches() -> dict:
    return {
        "bank": STATE.bank_m,
        "gw": STATE.current_gw,
        "next_gw": STATE.next_gw,
        "gw_next4": STATE.next_gw + 4,
        "ft": STATE.free_transfers,
        "deadline": STATE.deadline_label or f"GW{STATE.next_gw}",
    }


@app.get("/{filename}")
def static_file(filename: str):
    # Allow known static extensions only
    if not filename.endswith((".jsx", ".js", ".css", ".png", ".jpg", ".svg", ".ico")):
        raise HTTPException(404)
    path = DESIGN_DIR / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(404, f"{filename} not found")
    mime = "application/javascript" if filename.endswith((".js", ".jsx")) else None

    patches = _STATIC_PATCHES.get(filename)
    if patches:
        _load()
        text = path.read_text()
        vals = _format_patches()
        for needle, tmpl in patches:
            text = text.replace(needle, tmpl.format(**vals))
        return Response(content=text, media_type=mime or "application/javascript")

    return FileResponse(path, media_type=mime)


# Upload assets (if any referenced in the design)
app.mount("/uploads", StaticFiles(directory=str(DESIGN_DIR / "uploads")), name="uploads")
