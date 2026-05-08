import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from flask import Flask, request, jsonify
from _fpl import fpl_get, is_network_error, get_current_gw, get_next_gw

app = Flask(__name__)

_KNOWN_CLUBS = {
    "ARS","AVL","BOU","BRE","BHA","CHE","CRY","EVE","FUL",
    "IPS","LEI","LIV","MCI","MUN","NEW","NFO","SOU","TOT","WHU","WOL",
}


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
@app.route("/rival-squad/<int:entry_id>")
def rival_squad(entry_id):
    # Vercel also passes [id] as query param — support both
    if not entry_id:
        entry_id = request.args.get("id", type=int)
    if not entry_id:
        return jsonify({"error": "entry_id required"}), 400

    try:
        bootstrap = fpl_get("bootstrap-static/", timeout=10)
    except Exception as exc:
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
