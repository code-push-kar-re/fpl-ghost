import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, request, jsonify
from _fpl import (
    fpl_get, is_network_error,
    get_current_gw, get_next_gw,
    DEMO_MANAGER, DEMO_RIVALS,
)

app = Flask(__name__)

DEFAULT_ME = 9364099
DEFAULT_ID = 9364099

_KNOWN_CLUBS = {
    "ARS","AVL","BOU","BRE","BHA","CHE","CRY","EVE","FUL",
    "IPS","LEI","LIV","MCI","MUN","NEW","NFO","SOU","TOT","WHU","WOL",
}


# ── /api/onboard ────────────────────────────────────────────────────────────

@app.route("/api/onboard")
def onboard():
    raw_id = request.args.get("team_id", "")
    try:
        team_id = int(raw_id)
    except ValueError:
        return jsonify({"error": "team_id must be a number"}), 400

    try:
        entry = fpl_get(f"entry/{team_id}/")
    except Exception as exc:
        if is_network_error(exc) and team_id == DEFAULT_ID:
            return jsonify({**DEMO_MANAGER, "_offline": True})
        if is_network_error(exc):
            return jsonify({"error": "FPL API is temporarily unreachable. Please try again in a moment."}), 503
        return jsonify({"error": f"Team {team_id} not found. Double-check your ID and try again."}), 404

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

    return jsonify({
        "id":           team_id,
        "name":         f"{entry.get('player_first_name', '')} {entry.get('player_last_name', '')}".strip(),
        "team":         entry.get("name", "") or entry.get("entry_name", ""),
        "overall_rank": entry.get("summary_overall_rank", 0) or 0,
        "gw_points":    entry.get("summary_event_points", 0) or 0,
        "total_points": entry.get("summary_overall_points", 0) or 0,
        "leagues":      leagues,
    })


# ── /api/league/<fpl_id>/rivals ─────────────────────────────────────────────

@app.route("/api/league/<int:fpl_id>/rivals")
def rivals(fpl_id):
    me_id = request.args.get("me", DEFAULT_ME, type=int)

    try:
        data = fpl_get(f"leagues-classic/{fpl_id}/standings/")
    except Exception as exc:
        if is_network_error(exc):
            if fpl_id in DEMO_RIVALS:
                return jsonify(DEMO_RIVALS[fpl_id])
            return jsonify({"error": "FPL API is temporarily unreachable. Please try again in a moment."}), 503
        return jsonify({"error": f"League {fpl_id} not found."}), 404

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
            "isMe":    eid == me_id,
        })

    return jsonify(rows)


# ── /api/rival-squad/<entry_id> ─────────────────────────────────────────────

def _build_squad(picks, bootstrap, next_gw):
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

        ep_next = float(p.get("ep_next") or p.get("ep_this") or 0)
        xp_by_gw = [
            {"gw": next_gw + i, "xp": round(ep_next * max(0.5, 1.0 - i * 0.08), 2)}
            for i in range(5)
        ]

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


@app.route("/api/rival-squad/<int:entry_id>")
def rival_squad(entry_id):
    try:
        bootstrap = fpl_get("bootstrap-static/", timeout=10)
    except Exception:
        return jsonify({"error": "FPL API temporarily unreachable"}), 503

    current_gw = get_current_gw(bootstrap)
    next_gw    = get_next_gw(bootstrap)

    try:
        picks_data = fpl_get(f"entry/{entry_id}/event/{current_gw}/picks/")
    except Exception as exc:
        if is_network_error(exc):
            return jsonify({"error": "FPL API temporarily unreachable"}), 503
        return jsonify({"error": f"Could not load squad for entry {entry_id}"}), 404

    picks = picks_data.get("picks", [])
    if not picks:
        return jsonify({"error": "No picks found"}), 404

    return jsonify(_build_squad(picks, bootstrap, next_gw))
