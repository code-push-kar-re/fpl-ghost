import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from flask import Flask, request, jsonify
from _fpl import fpl_get, is_network_error, DEMO_RIVALS

app = Flask(__name__)

DEFAULT_ME = 9364099


@app.route("/api/league/<int:fpl_id>/rivals")
@app.route("/league/<int:fpl_id>/rivals")
def rivals(fpl_id):
    # Vercel also passes dynamic segment as query param — support both
    if not fpl_id:
        fpl_id = request.args.get("fpl_id", type=int)
    me_id = request.args.get("me", DEFAULT_ME, type=int)

    if not fpl_id:
        return jsonify({"error": "Invalid league ID"}), 400

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
        eid   = entry["entry"]
        prev  = entry.get("last_rank", entry["rank"])
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
