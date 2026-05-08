"""
Vercel serverless function — GET /api/league/<fpl_id>/rivals?me=<team_id>

Returns league standings as a list of rival objects ready for the Rivals step.
Falls back to offline demo snapshot when FPL API is unreachable.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

import urllib.parse
from http.server import BaseHTTPRequestHandler
from _fpl import fpl_get, is_network_error, json_response, DEMO_RIVALS

DEFAULT_ME = 9364099


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)

        # Vercel injects [fpl_id] as a query param; also try path extraction as fallback
        raw_lid = qs.get("fpl_id", [""])[0]
        if not raw_lid:
            # path: /api/league/1141763/rivals
            parts = [p for p in parsed.path.split("/") if p]
            # parts = ['api', 'league', '1141763', 'rivals']
            try:
                raw_lid = parts[-2]
            except IndexError:
                raw_lid = ""

        me_str = qs.get("me", [str(DEFAULT_ME)])[0]

        try:
            fpl_id = int(raw_lid)
            me_id  = int(me_str)
        except ValueError:
            json_response(self, {"error": "Invalid league or manager ID"}, 400)
            return

        # ── Fetch standings from FPL ────────────────────────────────────
        try:
            data = fpl_get(f"leagues-classic/{fpl_id}/standings/")
        except Exception as exc:
            if is_network_error(exc):
                # Return offline demo if we have it for this league
                if fpl_id in DEMO_RIVALS:
                    json_response(self, DEMO_RIVALS[fpl_id])
                    return
                json_response(self, {
                    "error": "FPL API is temporarily unreachable. Please try again in a moment."
                }, 503)
                return
            json_response(self, {"error": f"League {fpl_id} not found."}, 404)
            return

        # ── Shape the response ──────────────────────────────────────────
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
                "isMe":    eid == me_id,
            })

        json_response(self, rows)

    def log_message(self, *args):
        pass
