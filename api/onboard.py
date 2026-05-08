"""
Vercel serverless function — GET /api/onboard?team_id=<id>

Returns the manager's profile + list of classic leagues.
Falls back to offline demo snapshot when FPL API is unreachable.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import json
import urllib.parse
from http.server import BaseHTTPRequestHandler
from _fpl import fpl_get, is_network_error, json_response, DEMO_MANAGER

DEFAULT_ID = 9364099


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.end_headers()

    def do_GET(self):
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        raw_id = qs.get("team_id", [""])[0]

        try:
            team_id = int(raw_id)
        except ValueError:
            json_response(self, {"error": "team_id must be a number"}, 400)
            return

        # ── Fetch from FPL ───────────────────────────────────────────────
        try:
            entry = fpl_get(f"entry/{team_id}/")
        except Exception as exc:
            if is_network_error(exc) and team_id == DEFAULT_ID:
                # Return cached demo snapshot for the known dev manager
                json_response(self, {**DEMO_MANAGER, "_offline": True})
                return
            elif is_network_error(exc):
                json_response(self, {
                    "error": "FPL API is temporarily unreachable. Please try again in a moment."
                }, 503)
                return
            else:
                json_response(self, {
                    "error": f"Team {team_id} not found. Double-check your ID and try again."
                }, 404)
                return

        # ── Build leagues list ───────────────────────────────────────────
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

        result = {
            "id":           team_id,
            "name":         f"{entry.get('player_first_name', '')} {entry.get('player_last_name', '')}".strip(),
            "team":         entry.get("name", "") or entry.get("entry_name", ""),
            "overall_rank": entry.get("summary_overall_rank", 0) or 0,
            "gw_points":    entry.get("summary_event_points", 0) or 0,
            "total_points": entry.get("summary_overall_points", 0) or 0,
            "leagues":      leagues,
        }
        json_response(self, result)

    def log_message(self, *args):
        pass  # suppress default Apache-style logging
