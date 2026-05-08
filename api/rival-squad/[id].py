"""
Vercel serverless function — GET /api/rival-squad/<entry_id>

Fetches a manager's current GW picks from FPL and returns them in the
design-shape that CompareView expects (same format as window.RIVAL_SQUAD).

Projections use FPL's own ep_next value — no external ML dependencies needed.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

import urllib.parse
from http.server import BaseHTTPRequestHandler
from _fpl import fpl_get, is_network_error, json_response, get_current_gw, get_next_gw

# Clubs whose short names are known to jersey.jsx
_KNOWN_CLUBS = {
    "ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "CRY", "EVE", "FUL",
    "IPS", "LEI", "LIV", "MCI", "MUN", "NEW", "NFO", "SOU", "TOT", "WHU", "WOL",
}


def _build_squad(picks: list, bootstrap: dict, next_gw: int) -> list:
    """Convert raw FPL picks + bootstrap into design-shape player objects."""
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

        # Use FPL's own projected points — ep_next for the next GW, ep_this as fallback
        ep_next = float(p.get("ep_next") or p.get("ep_this") or 0)

        # Rough 5-GW xpByGw: decay by ~8% per GW (fixture schedule unknown here)
        xp_by_gw = [
            {"gw": next_gw + i, "xp": round(ep_next * max(0.5, 1.0 - i * 0.08), 2)}
            for i in range(5)
        ]

        status = p.get("status", "a")
        if status not in ("a", "i", "d", "s", "u"):
            status = "a"

        yellows = p.get("yellow_cards", 0)

        obj = {
            "id":       f"p{pid}",
            "name":     p.get("web_name", "Player"),
            "last":     (p.get("web_name", "PLAYER")).upper()[:10],
            "first":    p.get("first_name", ""),
            "club":     club,
            "pos":      p.get("element_type", 4),   # 1=GK 2=DEF 3=MID 4=FWD
            "price":    round(p.get("now_cost", 50) / 10.0, 1),
            "proj":     round(ep_next, 2),
            "form":     round(float(p.get("form") or 0), 1),
            "selected": round(float(p.get("selected_by_percent") or 0), 1),
            "captain":  pick.get("is_captain", False),
            "vice":     pick.get("is_vice_captain", False),
            "startIdx": pick["position"] - 1,       # 0-10 = starters, 11=GK bench, 12-14=bench
            "xpByGw":   xp_by_gw,
            "yellowCards": yellows,
            "status":   status,
            "news":     p.get("news") or None,
            "xGI":      round(float(p.get("expected_goal_involvements") or 0), 2),
        }

        # Yellow card risk badge
        if yellows >= 4:
            obj["card"] = {"yellows": yellows, "risk": "high"}

        # Injury / doubt detail
        if status == "d":
            obj["chance"] = p.get("chance_of_playing_next_round") or 50

        squad.append(obj)

    # Sort by pick position (starters first, then bench)
    squad.sort(key=lambda x: x["startIdx"])
    return squad


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs     = urllib.parse.parse_qs(parsed.query)

        # Vercel injects [id] as query param; also try extracting from path
        raw_id = qs.get("id", [""])[0]
        if not raw_id:
            parts  = [p for p in parsed.path.split("/") if p]
            raw_id = parts[-1] if parts else ""

        try:
            entry_id = int(raw_id)
        except ValueError:
            json_response(self, {"error": "entry_id must be a number"}, 400)
            return

        # ── 1. Fetch bootstrap (all player stats + current GW) ──────────
        # Bootstrap is ~2 MB — fetched fresh each call (no server-side cache on Vercel free tier)
        try:
            bootstrap = fpl_get("bootstrap-static/", timeout=10)
        except Exception as exc:
            if is_network_error(exc):
                json_response(self, {"error": "FPL API temporarily unreachable"}, 503)
            else:
                json_response(self, {"error": str(exc)}, 503)
            return

        current_gw = get_current_gw(bootstrap)
        next_gw    = get_next_gw(bootstrap)

        # ── 2. Fetch this manager's picks for the current GW ───────────
        try:
            picks_data = fpl_get(f"entry/{entry_id}/event/{current_gw}/picks/")
        except Exception as exc:
            if is_network_error(exc):
                json_response(self, {"error": "FPL API temporarily unreachable"}, 503)
            else:
                json_response(self, {
                    "error": f"Could not load squad for entry {entry_id}. They may not have made picks yet."
                }, 404)
            return

        picks = picks_data.get("picks", [])
        if not picks:
            json_response(self, {"error": "No picks found for this entry"}, 404)
            return

        # ── 3. Build + return design-shape squad ───────────────────────
        squad = _build_squad(picks, bootstrap, next_gw)
        json_response(self, squad)

    def log_message(self, *args):
        pass
