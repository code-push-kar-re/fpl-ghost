import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from collections import defaultdict
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from _fpl import (
    fpl_get, is_network_error,
    get_current_gw, get_next_gw,
    DEMO_MANAGER, DEMO_RIVALS,
)

app = FastAPI()

DEFAULT_ME = 9364099
FPL_LAST_GW = 38   # PL season always ends at GW38

_KNOWN_CLUBS = {
    "ARS","AVL","BOU","BRE","BHA","CHE","CRY","EVE","FUL",
    "IPS","LEI","LIV","MCI","MUN","NEW","NFO","SOU","TOT","WHU","WOL",
}

# FDR → projection multiplier for GWs beyond the immediate next one
_FDR_MULT = {1: 1.25, 2: 1.10, 3: 1.00, 4: 0.82, 5: 0.62}


def _build_fixtures_map():
    """Fetch all remaining fixtures and return team_id -> {gw: [fdr, ...]}."""
    try:
        fixtures = fpl_get("fixtures/", timeout=8)
    except Exception:
        return {}
    fx = defaultdict(lambda: defaultdict(list))
    for f in fixtures:
        ev = f.get("event")
        if not ev:
            continue
        fx[f["team_h"]][ev].append(f.get("team_h_difficulty", 3))
        fx[f["team_a"]][ev].append(f.get("team_a_difficulty", 3))
    return fx


def _xp_by_gw(ep_next: float, team_id: int, next_gw: int, fx_map: dict) -> list:
    """
    Build a 5-GW (or fewer if season ends) projection list.
    - GW next_gw   : use ep_next directly (FPL's own estimate)
    - Later GWs    : FDR-adjusted decay, DGW doubles, BGW zeros
    - Capped at GW38
    """
    result = []
    for i in range(5):
        gw = next_gw + i
        if gw > FPL_LAST_GW:
            break
        team_gw = fx_map.get(team_id, {}).get(gw, [])
        if i == 0:
            # Trust FPL's ep_next for the immediate next GW
            if not team_gw:
                xp = 0.0          # BGW confirmed
            elif len(team_gw) >= 2:
                xp = round(ep_next * 1.65, 2)  # DGW boost
            else:
                xp = round(ep_next, 2)
        else:
            # Decay base from ep_next, then adjust for fixture context
            base = ep_next * max(0.50, 1.0 - i * 0.07)
            if not team_gw:
                xp = 0.0          # BGW
            elif len(team_gw) >= 2:
                # DGW: both fixtures, second is ~60% of first
                fdr1, fdr2 = team_gw[0], team_gw[1]
                xp = round(
                    base * _FDR_MULT.get(fdr1, 1.0) +
                    base * 0.60 * _FDR_MULT.get(fdr2, 1.0),
                    2,
                )
            else:
                xp = round(base * _FDR_MULT.get(team_gw[0], 1.0), 2)
        result.append({"gw": gw, "xp": xp})
    return result


# ── /api/onboard ────────────────────────────────────────────────────────────

@app.get("/api/onboard")
def onboard(team_id: str = ""):
    try:
        team_id_int = int(team_id)
    except (ValueError, TypeError):
        return JSONResponse({"error": "team_id must be a number"}, status_code=400)

    try:
        entry = fpl_get(f"entry/{team_id_int}/")
    except Exception as exc:
        if is_network_error(exc) and team_id_int == DEFAULT_ME:
            return {**DEMO_MANAGER, "_offline": True}
        if is_network_error(exc):
            return JSONResponse(
                {"error": "FPL API is temporarily unreachable. Please try again in a moment."},
                status_code=503,
            )
        return JSONResponse(
            {"error": f"Team {team_id_int} not found. Double-check your ID and try again."},
            status_code=404,
        )

    leagues_raw = entry.get("leagues", {}).get("classic", [])
    leagues = []
    for lg in leagues_raw[:15]:
        lg_type = (
            "Global"
            if lg.get("league_type") == "s" and lg["id"] in (314, 486)
            else "Invitational"
        )
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
        "id":           team_id_int,
        "name":         f"{entry.get('player_first_name', '')} {entry.get('player_last_name', '')}".strip(),
        "team":         entry.get("name", "") or entry.get("entry_name", ""),
        "overall_rank": entry.get("summary_overall_rank", 0) or 0,
        "gw_points":    entry.get("summary_event_points", 0) or 0,
        "total_points": entry.get("summary_overall_points", 0) or 0,
        "leagues":      leagues,
    }


# ── /api/league/{fpl_id}/rivals ─────────────────────────────────────────────

@app.get("/api/league/{fpl_id}/rivals")
def rivals(fpl_id: int, me: int = DEFAULT_ME):
    try:
        data = fpl_get(f"leagues-classic/{fpl_id}/standings/")
    except Exception as exc:
        if is_network_error(exc):
            if fpl_id in DEMO_RIVALS:
                return DEMO_RIVALS[fpl_id]
            return JSONResponse(
                {"error": "FPL API is temporarily unreachable. Please try again in a moment."},
                status_code=503,
            )
        return JSONResponse({"error": f"League {fpl_id} not found."}, status_code=404)

    rows = []
    for entry in data.get("standings", {}).get("results", []):
        eid  = entry["entry"]
        prev = entry.get("last_rank", entry["rank"])
        rows.append({
            "id":      eid,
            "rank":    entry["rank"],
            "prev":    prev,
            "delta":   prev - entry["rank"],
            "manager": entry.get("player_name", ""),
            "team":    entry.get("entry_name", ""),
            "total":   entry.get("total", 0),
            "gw":      entry.get("event_total", 0),
            "isMe":    eid == me,
        })

    return rows


# ── /api/rival-squad/{entry_id} ─────────────────────────────────────────────

def _build_squad(picks, bootstrap, next_gw, fx_map=None):
    player_map = {e["id"]: e for e in bootstrap.get("elements", [])}
    team_map   = {t["id"]: t["short_name"] for t in bootstrap.get("teams", [])}
    squad = []

    for pick in picks:
        pid = pick["element"]
        p   = player_map.get(pid)
        if not p:
            continue

        club = team_map.get(p.get("team", 0), "ARS")
        if club not in _KNOWN_CLUBS:
            club = "ARS"

        ep_next  = float(p.get("ep_next") or p.get("ep_this") or 0)
        team_id  = p.get("team", 0)
        xp_by_gw = (
            _xp_by_gw(ep_next, team_id, next_gw, fx_map)
            if fx_map is not None
            else [{"gw": next_gw + i, "xp": round(ep_next * max(0.5, 1.0 - i * 0.08), 2)} for i in range(5)]
        )

        status = p.get("status", "a")
        if status not in ("a", "i", "d", "s", "u"):
            status = "a"

        yellows = p.get("yellow_cards", 0)
        obj = {
            "id":          f"p{pid}",
            "name":        p.get("web_name", "Player"),
            "last":        p.get("web_name", "PLAYER").upper()[:10],
            "first":       p.get("first_name", ""),
            "club":        club,
            "pos":         p.get("element_type", 4),
            "price":       round(p.get("now_cost", 50) / 10.0, 1),
            "proj":        round(ep_next, 2),
            "form":        round(float(p.get("form") or 0), 1),
            "selected":    round(float(p.get("selected_by_percent") or 0), 1),
            "captain":     pick.get("is_captain", False),
            "vice":        pick.get("is_vice_captain", False),
            "startIdx":    pick["position"] - 1,
            "xpByGw":      xp_by_gw,
            "yellowCards": yellows,
            "status":      status,
            "news":        p.get("news") or None,
            "xGI":         round(float(p.get("expected_goal_involvements") or 0), 2),
        }
        if yellows >= 4:
            obj["card"] = {"yellows": yellows, "risk": "high"}
        if status == "d":
            obj["chance"] = p.get("chance_of_playing_next_round") or 50

        squad.append(obj)

    squad.sort(key=lambda x: x["startIdx"])
    return squad


@app.get("/api/rival-squad/{entry_id}")
def rival_squad(entry_id: int):
    try:
        bootstrap = fpl_get("bootstrap-static/", timeout=10)
    except Exception:
        return JSONResponse({"error": "FPL API temporarily unreachable"}, status_code=503)

    current_gw = get_current_gw(bootstrap)
    next_gw    = get_next_gw(bootstrap)
    fx_map     = _build_fixtures_map()   # fetch fixture data for accurate xpByGw

    try:
        picks_data = fpl_get(f"entry/{entry_id}/event/{current_gw}/picks/")
    except Exception as exc:
        if is_network_error(exc):
            return JSONResponse({"error": "FPL API temporarily unreachable"}, status_code=503)
        return JSONResponse(
            {"error": f"Could not load squad for entry {entry_id}"},
            status_code=404,
        )

    picks = picks_data.get("picks", [])
    if not picks:
        return JSONResponse({"error": "No picks found"}, status_code=404)

    return _build_squad(picks, bootstrap, next_gw, fx_map)


# ── /api/player-pool ─────────────────────────────────────────────────────────
# Returns all non-injured FPL players — used by the transfer simulator as candidates.

@app.get("/api/player-pool")
def player_pool():
    try:
        bootstrap = fpl_get("bootstrap-static/", timeout=10)
    except Exception:
        return JSONResponse({"error": "FPL API temporarily unreachable"}, status_code=503)

    next_gw  = get_next_gw(bootstrap)
    team_map = {t["id"]: t["short_name"] for t in bootstrap.get("teams", [])}
    fx_map   = _build_fixtures_map()   # DGW/BGW-aware projections
    players  = []

    for p in bootstrap.get("elements", []):
        status = p.get("status", "a")
        if status not in ("a", "d"):          # skip injured / suspended / unavailable
            continue

        club = team_map.get(p.get("team", 0), "ARS")
        if club not in _KNOWN_CLUBS:
            club = "ARS"

        ep_next  = float(p.get("ep_next") or p.get("ep_this") or 0)
        team_id  = p.get("team", 0)
        xp_by_gw = _xp_by_gw(ep_next, team_id, next_gw, fx_map)

        players.append({
            "id":       f"p{p['id']}",
            "name":     p.get("web_name", "Player"),
            "first":    p.get("first_name", ""),
            "club":     club,
            "pos":      p.get("element_type", 4),
            "price":    round(p.get("now_cost", 50) / 10.0, 1),
            "proj":     round(ep_next, 2),
            "form":     round(float(p.get("form") or 0), 1),
            "selected": round(float(p.get("selected_by_percent") or 0), 1),
            "status":   status,
            "xpByGw":  xp_by_gw,
        })

    # Sort by projected points descending
    players.sort(key=lambda x: x["proj"], reverse=True)
    return players
