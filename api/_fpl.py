"""
Shared FPL API helpers — pure stdlib, no external dependencies.
Used by all three serverless functions.
"""
import json
import urllib.request
import urllib.error

FPL_BASE = "https://fantasy.premierleague.com/api/"
_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# Offline demo snapshot — used when FPL API is unreachable for the known demo user
DEMO_MANAGER = {
    "id":           9364099,
    "name":         "Pushkar Bhattacharya",
    "team":         "7DragonAndroids",
    "overall_rank": 450_312,
    "gw_points":    52,
    "total_points": 2156,
    "leagues": [
        {"id": "lg_1141763", "fpl_id": 1141763, "name": "Zweden PL",
         "size": 21, "my_rank": 10, "prev_rank": 11, "type": "Invitational"},
        {"id": "lg_314",     "fpl_id": 314,     "name": "Overall",
         "size": 11_000_000, "my_rank": 450_312, "prev_rank": 490_000, "type": "Global"},
        {"id": "lg_276",     "fpl_id": 276,     "name": "Gameweek 1",
         "size": 8_200_000, "my_rank": 380_450, "prev_rank": 401_100, "type": "Global"},
    ],
}

DEMO_RIVALS = {
    1141763: [
        {"id": 646223,  "rank": 1,  "prev": 1,  "delta":  0, "manager": "Anuj Raj Sharma",      "team": "My hits don't lie",  "total": 2234, "gw": 65, "isMe": False},
        {"id": 881640,  "rank": 2,  "prev": 3,  "delta":  1, "manager": "Krishna Venkateswaran","team": "Captain's Curse",    "total": 2219, "gw": 58, "isMe": False},
        {"id": 3221595, "rank": 3,  "prev": 2,  "delta": -1, "manager": "Vishal Jain",           "team": "Kinder Mbeumo",      "total": 2211, "gw": 61, "isMe": False},
        {"id": 439661,  "rank": 4,  "prev": 4,  "delta":  0, "manager": "Ajay Venkitaraman",     "team": "Bros of Destruction","total": 2205, "gw": 70, "isMe": False},
        {"id": 9003800, "rank": 5,  "prev": 6,  "delta":  1, "manager": "Nimit Sinha",           "team": "Terminator",         "total": 2198, "gw": 73, "isMe": False},
        {"id": 6260365, "rank": 6,  "prev": 5,  "delta": -1, "manager": "Manoj Dimri",           "team": "GloryforPEP26",      "total": 2190, "gw": 49, "isMe": False},
        {"id": 666932,  "rank": 7,  "prev": 8,  "delta":  1, "manager": "Laksh Chadha",          "team": "FPL KITKAT",         "total": 2184, "gw": 55, "isMe": False},
        {"id": 5242984, "rank": 8,  "prev": 7,  "delta": -1, "manager": "Ankit Gupta",           "team": "Blue walkers",       "total": 2180, "gw": 47, "isMe": False},
        {"id": 4949403, "rank": 9,  "prev": 10, "delta":  1, "manager": "Ravi Kaushik",          "team": "MoonrakerFC",        "total": 2170, "gw": 60, "isMe": False},
        {"id": 9364099, "rank": 10, "prev": 11, "delta":  1, "manager": "Pushkar Bhattacharya",  "team": "7DragonAndroids",    "total": 2156, "gw": 52, "isMe": True},
        {"id": 664102,  "rank": 11, "prev": 9,  "delta": -2, "manager": "Jay",                   "team": "Jay's United",       "total": 2148, "gw": 44, "isMe": False},
        {"id": 8387998, "rank": 12, "prev": 12, "delta":  0, "manager": "Shantanu Jain",         "team": "gichigichi",         "total": 2140, "gw": 51, "isMe": False},
        {"id": 4046941, "rank": 13, "prev": 14, "delta":  1, "manager": "Rahul Mishra",          "team": "Sunny Innit FC",     "total": 2131, "gw": 63, "isMe": False},
        {"id": 3963147, "rank": 14, "prev": 13, "delta": -1, "manager": "Samarth Ladia",         "team": "Mahishmati XI",      "total": 2122, "gw": 48, "isMe": False},
        {"id": 2363493, "rank": 15, "prev": 15, "delta":  0, "manager": "Sourav Moonka",         "team": "The Dark Knights",   "total": 2115, "gw": 57, "isMe": False},
        {"id": 5227517, "rank": 16, "prev": 16, "delta":  0, "manager": "Pooja Yadav",           "team": "KittyKickers FC",    "total": 2108, "gw": 66, "isMe": False},
        {"id": 3363033, "rank": 17, "prev": 17, "delta":  0, "manager": "Rishab Gupta",          "team": "BlueBlues",          "total": 2097, "gw": 50, "isMe": False},
        {"id": 5462017, "rank": 18, "prev": 18, "delta":  0, "manager": "Pramit Shah",           "team": "Laal Shaitaan XI",   "total": 2089, "gw": 43, "isMe": False},
        {"id": 9078546, "rank": 19, "prev": 20, "delta":  1, "manager": "Sunil Halasnad",        "team": "Next Season",        "total": 2080, "gw": 59, "isMe": False},
        {"id": 7197834, "rank": 20, "prev": 19, "delta": -1, "manager": "rohan parihar",         "team": "GoalGetter",         "total": 2071, "gw": 42, "isMe": False},
        {"id": 1554189, "rank": 21, "prev": 21, "delta":  0, "manager": "Abhijay Giri",          "team": "AGWarriors",         "total": 2062, "gw": 55, "isMe": False},
    ],
}


def fpl_get(path: str, timeout: int = 9) -> dict:
    """Fetch a FPL API path and return parsed JSON. Raises on HTTP / network error."""
    url = FPL_BASE + path
    req = urllib.request.Request(url, headers={"User-Agent": _UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def is_network_error(exc: Exception) -> bool:
    msg = str(exc)
    keywords = ("NameResolution", "ConnectionPool", "Max retries", "Failed to resolve",
                 "timed out", "urlopen error", "getaddrinfo")
    return any(k.lower() in msg.lower() for k in keywords)


def json_response(handler, data, status: int = 200) -> None:
    """Write a JSON HTTP response via a BaseHTTPRequestHandler."""
    body = json.dumps(data).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
    handler.end_headers()
    handler.wfile.write(body)


def get_current_gw(bootstrap: dict) -> int:
    for ev in bootstrap.get("events", []):
        if ev.get("is_current"):
            return ev["id"]
    last = 1
    for ev in bootstrap["events"]:
        if ev.get("finished"):
            last = ev["id"]
    return last


def get_next_gw(bootstrap: dict) -> int:
    for ev in bootstrap.get("events", []):
        if ev.get("is_next"):
            return ev["id"]
    return get_current_gw(bootstrap) + 1
