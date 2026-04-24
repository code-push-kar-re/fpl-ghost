"""
FPL Ghost web server — wires the Claude Design React prototype to the real FPL backend.

Serves:
  GET  /                       → FPL Ghost.html
  GET  /data.jsx               → dynamically generated with REAL FPL data
  GET  /*.jsx, /*.js           → static design files from design_reference/
  GET  /api/refresh            → force-clear 10-minute cache and re-fetch

Run:
  .venv/bin/python -m uvicorn web_server:app --reload --port 8000
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
import optimizer as opt_engine
from models import Player, Squad


app = FastAPI(title="FPL Ghost")

PROJECT_ROOT = Path(__file__).parent
DESIGN_DIR   = PROJECT_ROOT / "design_reference"

DEFAULT_MANAGER_ID = 9364099
DEFAULT_RIVAL_ID   = 646223
DEFAULT_LEAGUE_ID  = 1141763   # Zweden PL
DEFAULT_HORIZON    = 5
BACKTEST_GW        = 31        # Use a completed regular GW for accuracy check


# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------

class _State:
    bootstrap              = None
    players: list[Player]  = []
    player_map: dict       = {}
    current_gw: int        = 1
    next_gw: int           = 1
    team_short: dict       = {}
    bank_m: float          = 0.0
    free_transfers: int    = 1
    transfers_used: int    = 0
    transfer_cost: int     = 0
    manager_name: str      = ""
    overall_rank: int      = 0
    deadline_label: str    = ""
    team_strength: dict    = {}   # {team_id: {attack_home, attack_away, ...}}
    hist_team_stats: dict  = {}   # {team_id: {home_scored_avg, ...}}
    optimal_by_gw: dict    = {}   # {gw: {xi_ids, captain_id, vice_id, total_xp}}
    calibration: list      = []   # [{name, our_xp, fpl_ep, pos}]
    element_data: dict     = {}   # {player_id: ElementData} — kept for backtest
    squad_pids: set        = set()
    gw_accuracy: list      = []   # [{name, pred, actual, error, fixtures}]

STATE = _State()


def _load() -> None:
    """Load FPL bootstrap + derive xP. Safe to call repeatedly (cached)."""
    if STATE.bootstrap is not None:
        return

    STATE.bootstrap = fpl_api.get_bootstrap()
    STATE.players   = fpl_api.build_players(STATE.bootstrap)
    STATE.current_gw = fpl_api.get_current_gw(STATE.bootstrap)

    for ev in STATE.bootstrap["events"]:
        if ev.get("is_next"):
            STATE.next_gw = ev["id"]
            break
    else:
        STATE.next_gw = STATE.current_gw + 1

    # --- Team strength (from bootstrap teams array) ---
    try:
        STATE.team_strength = xp_engine.build_team_strength_map(STATE.bootstrap)
    except Exception:
        STATE.team_strength = {}

    # --- Historical goal rates (from finished fixtures) ---
    try:
        all_fixtures        = fpl_api.get_fixtures()
        STATE.hist_team_stats = xp_engine.build_hist_team_stats(all_fixtures)
    except Exception:
        STATE.hist_team_stats = {}

    # --- Element-summaries for squad players (v3 xP model) ---
    element_data: dict = {}
    try:
        picks_raw = fpl_api.get_entry_picks(DEFAULT_MANAGER_ID, STATE.current_gw)
        squad_ids = [p["element"] for p in picks_raw.get("picks", [])]
        STATE.squad_pids = set(squad_ids)
        raw_summaries = fpl_api.get_element_summaries_parallel(squad_ids)
        for pid, raw in raw_summaries.items():
            if raw:
                element_data[pid] = xp_engine.parse_element_data(pid, raw)
        STATE.element_data = element_data
    except Exception:
        pass

    xp_engine.enrich_players_with_xp(
        STATE.players,
        bootstrap=STATE.bootstrap,
        start_gw=STATE.current_gw,
        horizon_gws=DEFAULT_HORIZON,
        element_data=element_data or None,
        team_strength=STATE.team_strength or None,
        hist_team_stats=STATE.hist_team_stats or None,
    )
    STATE.player_map = {p.id: p for p in STATE.players}
    STATE.team_short = {t["id"]: t["short_name"] for t in STATE.bootstrap["teams"]}

    # --- Manager info ---
    try:
        entry = fpl_api.get_entry(DEFAULT_MANAGER_ID)
        STATE.bank_m        = entry.get("last_deadline_bank", 0) / 10.0
        STATE.manager_name  = f"{entry.get('player_first_name','')} {entry.get('player_last_name','')}".strip()
        STATE.overall_rank  = entry.get("summary_overall_rank", 0) or 0
    except Exception:
        STATE.bank_m = 0.0

    # --- Free transfers + transfers used ---
    try:
        picks_data = fpl_api.get_entry_picks(DEFAULT_MANAGER_ID, STATE.current_gw)
        eh = picks_data.get("entry_history", {})
        STATE.transfers_used = eh.get("event_transfers", 0)
        STATE.transfer_cost  = eh.get("event_transfers_cost", 0)
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

    # --- Deadline label ---
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

    # --- GW accuracy: backtest against completed GW ---
    try:
        STATE.gw_accuracy = _build_gw_accuracy(BACKTEST_GW)
    except Exception:
        STATE.gw_accuracy = []

    # --- Calibration: our xP vs FPL's ep_next (squad players only) ---
    try:
        picks_data = fpl_api.get_entry_picks(DEFAULT_MANAGER_ID, STATE.current_gw)
        squad_pids = {p["element"] for p in picks_data.get("picks", [])}
        pos_names  = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}
        STATE.calibration = [
            {
                "name":    p.web_name,
                "our_xp":  round(p.xP, 2),
                "fpl_ep":  round(p.ep_next, 2),
                "pos":     pos_names.get(p.position, "?"),
                "diff":    round(p.xP - p.ep_next, 2),
            }
            for p in STATE.players
            if p.id in squad_pids
        ]
        STATE.calibration.sort(key=lambda r: -r["our_xp"])
    except Exception:
        STATE.calibration = []


def _run_optimizer(my_squad_json: list[dict]) -> None:
    """Build per-GW optimal lineups from the squad JSON and store in STATE."""
    if not my_squad_json:
        STATE.optimal_by_gw = {}
        return
    gws = [STATE.next_gw + i for i in range(DEFAULT_HORIZON)]
    raw_results = opt_engine.build_optimal_lineups(my_squad_json, gws)

    # Convert xi_ids (set) to list for JSON serialisation; look up captain name
    id_to_name = {p["id"]: p.get("name", "") for p in my_squad_json}
    STATE.optimal_by_gw = {}
    for gw, res in raw_results.items():
        STATE.optimal_by_gw[gw] = {
            "xiIds":       list(res["xi_ids"]),
            "captainId":   res["captain_id"],
            "viceId":      res["vice_id"],
            "captainName": id_to_name.get(res["captain_id"], ""),
            "viceName":    id_to_name.get(res["vice_id"], ""),
            "totalXp":     res["total_xp"],
        }


def _build_gw_accuracy(target_gw: int = BACKTEST_GW) -> list[dict]:
    """
    Compare our model's predictions for a completed GW vs actual points scored.

    Prediction uses element-summary history filtered to rounds BEFORE target_gw,
    so there is zero look-ahead bias — this is exactly what the model would have
    predicted had it run the evening before that GW's deadline.

    Actual points come from the FPL live endpoint for that GW.
    """
    import fixture_engine

    # --- Actual points from live GW data ---
    try:
        live = fpl_api.get_live_gw(target_gw)
        # {player_id: {total_points, minutes, goals_scored, ...}}
        live_map = {
            el["id"]: el.get("stats", {})
            for el in live.get("elements", [])
        }
    except Exception:
        return []

    # --- GW fixtures (handles DGW: multiple fixtures per team) ---
    try:
        schedule = fixture_engine.build_team_schedule(STATE.bootstrap, target_gw, 1)
    except Exception:
        return []

    pos_names = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}
    rows = []

    for player in STATE.players:
        if player.id not in STATE.squad_pids:
            continue

        # Build a truncated ElementData: only history from rounds BEFORE target_gw
        el_full = STATE.element_data.get(player.id)
        if el_full is not None:
            pre_history = [h for h in el_full.history if h["round"] < target_gw]
            truncated_el = xp_engine.ElementData(
                player_id=player.id,
                history=pre_history,
                upcoming=el_full.upcoming,
            )
        else:
            truncated_el = None

        # GW fixtures for this player's team
        gw_fixtures = [f for f in schedule.get(player.team_id, []) if f.gw == target_gw]

        pred_xp = xp_engine._player_xp_for_gw(
            player, gw_fixtures, truncated_el,
            STATE.team_strength or None,
            STATE.hist_team_stats or None,
        )

        stats   = live_map.get(player.id, {})
        actual  = stats.get("total_points", 0)
        minutes = stats.get("minutes", 0)
        # Count unique fixtures player actually featured in (minutes > 0 across fixtures)
        # For DGW tracking, use fixture count from schedule
        num_fixtures = len(gw_fixtures)

        rows.append({
            "name":     player.web_name,
            "pos":      pos_names.get(player.position, "?"),
            "club":     STATE.team_short.get(player.team_id, ""),
            "pred":     round(pred_xp, 2),
            "actual":   actual,
            "error":    round(pred_xp - actual, 2),
            "minutes":  minutes,
            "fixtures": num_fixtures,
            "dgw":      num_fixtures >= 2,
        })

    rows.sort(key=lambda r: -r["actual"])
    return rows


# ---------------------------------------------------------------------------
# FPL → design-shape converter
# ---------------------------------------------------------------------------

_KNOWN_CLUBS = {
    "ARS","AVL","BOU","BRE","BHA","BUR","CHE","CRY","EVE","FUL",
    "LEE","LIV","MCI","MUN","NEW","NFO","SUN","TOT","WHU","WOL",
}


def _status_flag(player: Player) -> dict:
    out = {"status": "a", "news": None}
    if player.status == "i":
        out.update(status="i", news=player.news or "Injured")
    elif player.status == "s":
        out.update(status="s", news=player.news or "Suspended")
    elif player.status == "u":
        out.update(status="u", news=player.news or "Unavailable")
    elif player.status == "d":
        out.update(status="d", chance=player.chance_next,
                   news=player.news or f"Doubt — {player.chance_next}%")
    if player.yellow_cards >= 4:
        out["card"] = {"yellows": player.yellow_cards, "risk": "high"}
    return out


def _fixture_flags(player: Player, start_gw: int) -> dict:
    import fixture_engine
    schedule    = fixture_engine.build_team_schedule(STATE.bootstrap, start_gw, 1)
    gw_fixtures = [f for f in schedule.get(player.team_id, []) if f.gw == start_gw]
    if len(gw_fixtures) >= 2:
        return {"dgw": True}
    if len(gw_fixtures) == 0:
        return {"bgw": True}
    return {}


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
    proj  = player.xP_by_gw.get(display_gw, player.xP)
    xp_by_gw = [
        {"gw": display_gw + i, "xp": round(player.xP_by_gw.get(display_gw + i, 0.0), 2)}
        for i in range(5)
    ]
    return {
        "id":          f"p{player.id}",
        "name":        player.web_name,
        "last":        player.web_name.upper()[:10],
        "first":       player.first_name,
        "club":        short,
        "pos":         player.position,
        "price":       round(player.cost / 10.0, 1),
        "proj":        round(proj, 2),
        "form":        round(player.form, 1),
        "selected":    round(player.selected_by_percent, 1),
        "captain":     is_captain,
        "vice":        is_vice,
        "startIdx":    pick_idx,
        "xpByGw":      xp_by_gw,
        "yellowCards": player.yellow_cards,
        **_status_flag(player),
        **_fixture_flags(player, display_gw),
    }


def _build_squad_json(manager_id: int) -> list[dict]:
    picks_data = fpl_api.get_entry_picks(manager_id, STATE.current_gw)
    picks      = picks_data.get("picks", [])
    squad      = []
    for pick in picks:
        pid    = pick["element"]
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
    try:
        data = fpl_api.get_league_standings(league_id)
    except Exception:
        return []
    rows = []
    for entry in data.get("standings", {}).get("results", []):
        eid = entry["entry"]
        rows.append({
            "rank":    entry["rank"],
            "prev":    entry.get("last_rank", entry["rank"]),
            "manager": entry["player_name"],
            "team":    entry["entry_name"],
            "total":   entry["total"],
            "gw":      entry.get("event_total", 0),
            "id":      "me" if eid == me_id else ("rival" if eid == rival_id else f"u{eid}"),
            "isMe":    eid == me_id,
        })
    return rows


def _build_my_leagues_json(manager_id: int) -> list[dict]:
    try:
        entry = fpl_api._get(f"entry/{manager_id}/")
    except Exception:
        return []
    out = []
    for lg in entry.get("leagues", {}).get("classic", []):
        out.append({
            "id":       f"lg_{lg['id']}",
            "fpl_id":   lg["id"],
            "name":     lg["name"],
            "code":     None,
            "size":     lg.get("rank_count", 0),
            "myRank":   lg.get("entry_rank", 0),
            "prevRank": lg.get("entry_last_rank", lg.get("entry_rank", 0)),
            "active":   lg["id"] == DEFAULT_LEAGUE_ID,
            "isGlobal": lg.get("league_type") == "s" and lg["id"] == 314,
        })
    return out


def _build_player_pool() -> list[dict]:
    """All FPL players as player-pool objects for the Transfers view."""
    out = []
    for p in sorted(STATE.players, key=lambda x: -x.xP):
        short = STATE.team_short.get(p.team_id, "ARS")
        if short not in _KNOWN_CLUBS:
            short = "ARS"
        out.append({
            "id":          f"p{p.id}",
            "name":        p.web_name,
            "last":        p.web_name.upper()[:10],
            "first":       p.first_name,
            "club":        short,
            "pos":         p.position,
            "price":       round(p.cost / 10.0, 1),
            "proj":        round(p.xP, 2),
            "form":        round(p.form, 1),
            "selected":    round(p.selected_by_percent, 1),
            "xGI":         round(p.xgi_per_90, 2),
            "status":      p.status if p.status in ("a","i","d","s","u") else "a",
            "news":        p.news or None,
            "yellowCards": p.yellow_cards,
            "xpByGw":      [
                {"gw": STATE.next_gw + i, "xp": round(p.xP_by_gw.get(STATE.next_gw + i, 0.0), 2)}
                for i in range(5)
            ],
        })
    return out


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/mvp", response_class=HTMLResponse)
def mvp_index():
    html_path = DESIGN_DIR / "FPL Ghost MVP.html"
    if not html_path.exists():
        raise HTTPException(500, "MVP HTML not found")
    return HTMLResponse(html_path.read_text())


@app.get("/", response_class=HTMLResponse)
def index():
    html_path = DESIGN_DIR / "FPL Ghost.html"
    if not html_path.exists():
        raise HTTPException(500, "Design HTML not found")
    content = html_path.read_text()
    banner = """
    <div id="live-banner" style="position:fixed;bottom:12px;left:12px;z-index:9999;
         background:#5c7a4f;color:#fff;padding:6px 12px;border-radius:8px;
         font-family:Inter,sans-serif;font-size:11px;font-weight:500;
         box-shadow:0 4px 12px rgba(60,30,50,0.15)">
      ● LIVE — real FPL data (manager 9364099 vs 646223)
    </div>
    """
    return HTMLResponse(content.replace("</body>", banner + "</body>"))


@app.get("/data.jsx")
def data_jsx(me: int = DEFAULT_MANAGER_ID, rival: int = DEFAULT_RIVAL_ID,
             league: int = DEFAULT_LEAGUE_ID):
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

    # Run optimizer after squad is built
    try:
        _run_optimizer(my_squad)
    except Exception:
        STATE.optimal_by_gw = {}

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

    my_mean    = round(sum(p["proj"] for p in my_squad[:11]) +
                       next((p["proj"] for p in my_squad if p.get("captain")), 0), 1) or 50.0
    rival_mean = round(sum(p["proj"] for p in rival_squad[:11]) +
                       next((p["proj"] for p in rival_squad if p.get("captain")), 0), 1) or 50.0

    # Serialise optimal_by_gw: convert sets to lists (already done in _run_optimizer)
    optimal_by_gw_json = json.dumps(STATE.optimal_by_gw)

    static_src = (DESIGN_DIR / "data.jsx").read_text()
    cut_idx    = static_src.find("const MY_SQUAD")
    header     = static_src[:cut_idx]

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

const GW_TIMELINE = [
{",".join(
  f'  {{ gw: {STATE.next_gw + i}, proj: {my_mean * (0.9 + 0.05*i):.1f}, actual: null, ft: {max(1, 15-i)}, itb: {STATE.bank_m:.1f}, chip: null, active: {str(i==0).lower()} }}'
  for i in range(DEFAULT_HORIZON)
)}
];

const LIVE_MATCHES = [];

window.FPL_STATE = {{
  currentGw:    {STATE.current_gw},
  nextGw:       {STATE.next_gw},
  bank:         {STATE.bank_m:.1f},
  freeTransfers:{STATE.free_transfers},
  transfersUsed:{STATE.transfers_used},
  transferCost: {STATE.transfer_cost},
  managerName:  {json.dumps(STATE.manager_name)},
  overallRank:  {STATE.overall_rank},
  deadline:     {json.dumps(STATE.deadline_label)},
  optimalByGw:  {optimal_by_gw_json},
  calibration:  {json.dumps(STATE.calibration)},
  gwAccuracy:   {json.dumps(STATE.gw_accuracy)},
  backtestGw:   {BACKTEST_GW},
}};

const MY_DIST    = {{ mean: {my_mean}, stddev: 15.2, p40: {my_mean + 4.5:.1f}, p60: {my_mean - 0.3:.1f}, p80: {my_mean - 15:.1f} }};
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

    return Response(content=header + dynamic, media_type="application/javascript")


@app.get("/api/refresh")
def refresh():
    fpl_api.clear_cache()
    STATE.bootstrap        = None
    STATE.players          = []
    STATE.player_map       = {}
    STATE.team_strength    = {}
    STATE.hist_team_stats  = {}
    STATE.optimal_by_gw    = {}
    STATE.calibration      = []
    STATE.gw_accuracy      = []
    STATE.element_data     = {}
    STATE.squad_pids       = set()
    return {"ok": True}


@app.get("/api/entry/{entry_id}")
def api_entry(entry_id: int):
    return fpl_api.get_entry(entry_id)


@app.get("/api/entry/{entry_id}/transfers")
def api_entry_transfers(entry_id: int):
    return fpl_api.get_entry_transfers(entry_id)


@app.get("/api/entry/{entry_id}/history")
def api_entry_history(entry_id: int):
    return fpl_api.get_entry_history(entry_id)


@app.get("/api/element/{element_id}")
def api_element(element_id: int):
    return fpl_api.get_element_summary(element_id)


@app.get("/api/fixtures")
def api_fixtures(event: Optional[int] = None):
    return fpl_api.get_fixtures(event=event)


@app.get("/api/live/{gw}")
def api_live(gw: int):
    return fpl_api.get_live_gw(gw)


@app.get("/api/onboard")
def api_onboard(team_id: int):
    """
    Fetch a manager's profile + leagues for the MVP onboarding flow.
    Returns: id, name, team, overall_rank, total_points, gw_points, leagues[].
    """
    try:
        entry = fpl_api.get_entry(team_id)
    except Exception as exc:
        raise HTTPException(404, f"Team {team_id} not found: {exc}")

    leagues_raw = entry.get("leagues", {}).get("classic", [])
    leagues = []
    for lg in leagues_raw[:15]:
        lg_type = "Global" if (lg.get("league_type") == "s" and lg["id"] in (314, 486)) else "Invitational"
        leagues.append({
            "id":        f"lg_{lg['id']}",
            "fpl_id":    lg["id"],
            "name":      lg["name"],
            "size":      lg.get("rank_count", 0) or 0,
            "my_rank":   lg.get("entry_rank", 0),
            "prev_rank": lg.get("entry_last_rank", lg.get("entry_rank", 0)),
            "type":      lg_type,
        })

    return {
        "id":           team_id,
        "name":         f"{entry.get('player_first_name', '')} {entry.get('player_last_name', '')}".strip(),
        "team":         entry.get("name", "") or entry.get("entry_name", ""),
        "overall_rank": entry.get("summary_overall_rank", 0) or 0,
        "gw_points":    entry.get("summary_event_points", 0) or 0,
        "total_points": entry.get("summary_overall_points", 0) or 0,
        "leagues":      leagues,
    }


@app.get("/api/league/{fpl_league_id}/rivals")
def api_league_rivals(fpl_league_id: int, me: int = DEFAULT_MANAGER_ID):
    """
    Return standings for a classic league — used by the Rivals step to show who to benchmark against.
    """
    try:
        data = fpl_api.get_league_standings(fpl_league_id)
    except Exception as exc:
        raise HTTPException(404, str(exc))

    rows = []
    for entry in data.get("standings", {}).get("results", []):
        eid   = entry["entry"]
        prev  = entry.get("last_rank", entry["rank"])
        delta = prev - entry["rank"]
        rows.append({
            "id":      eid,
            "rank":    entry["rank"],
            "prev":    prev,
            "delta":   delta,
            "manager": entry.get("player_name", ""),
            "team":    entry.get("entry_name", ""),
            "total":   entry.get("total", 0),
            "gw":      entry.get("event_total", 0),
            "isMe":    eid == me,
        })
    return rows


@app.get("/api/regions")
def api_regions():
    return fpl_api.get_regions()


@app.get("/api/best-leagues")
def api_best_leagues():
    return fpl_api.get_best_private_leagues()


@app.get("/api/summary")
def summary():
    _load()
    return {
        "current_gw":     STATE.current_gw,
        "next_gw":        STATE.next_gw,
        "players_loaded": len(STATE.players),
        "team_strength":  len(STATE.team_strength),
        "hist_stats":     len(STATE.hist_team_stats),
        "optimal_gws":    list(STATE.optimal_by_gw.keys()),
        "calibration":    STATE.calibration[:5],
        "bank_m":         STATE.bank_m,
    }


# ---------------------------------------------------------------------------
# Static file serving with runtime patches
# ---------------------------------------------------------------------------

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
        "bank":     STATE.bank_m,
        "gw":       STATE.current_gw,
        "next_gw":  STATE.next_gw,
        "gw_next4": STATE.next_gw + 4,
        "ft":       STATE.free_transfers,
        "deadline": STATE.deadline_label or f"GW{STATE.next_gw}",
    }


@app.get("/{filename}")
def static_file(filename: str):
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


app.mount("/uploads", StaticFiles(directory=str(DESIGN_DIR / "uploads")), name="uploads")
