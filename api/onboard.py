import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, request, jsonify
from _fpl import fpl_get, is_network_error, DEMO_MANAGER

app = Flask(__name__)

DEFAULT_ID = 9364099


@app.route("/api/onboard")
@app.route("/onboard")
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
