"""FPL API wrapper with 10-minute request-level caching."""

import requests
import requests_cache
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import config
from models import Player, Squad, RivalEntry

requests_cache.install_cache(
    "fpl_ghost_cache",
    backend="memory",
    expire_after=config.CACHE_TTL_SECONDS,
    allowable_methods=["GET"],
)

BASE = config.FPL_BASE_URL


def clear_cache() -> None:
    requests_cache.clear()


def _get(path: str, params: Optional[dict] = None) -> dict:
    url = f"{BASE}{path}"
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Raw endpoint wrappers
# ---------------------------------------------------------------------------

def get_bootstrap() -> dict:
    """Global player, team, and event data."""
    return _get("bootstrap-static/")


def get_league_standings(league_id: int, page: int = 1) -> dict:
    return _get(
        f"leagues-classic/{league_id}/standings/",
        params={"page_standings": page},
    )


def get_entry_picks(entry_id: int, gw: int) -> dict:
    return _get(f"entry/{entry_id}/event/{gw}/picks/")


def get_entry_history(entry_id: int) -> dict:
    return _get(f"entry/{entry_id}/history/")


def get_live_gw(gw: int) -> dict:
    return _get(f"event/{gw}/live/")


def get_fixtures(event: Optional[int] = None) -> list:
    params = {"event": event} if event is not None else None
    return _get("fixtures/", params=params)


def get_entry(entry_id: int) -> dict:
    """General team info: manager name, kit, leagues, bank, value."""
    return _get(f"entry/{entry_id}/")


def get_entry_transfers(entry_id: int) -> list:
    """All transfers performed by a team this season."""
    return _get(f"entry/{entry_id}/transfers/")


def get_element_summary(element_id: int) -> dict:
    """Per-player: fixtures w/ FDR, history (per-GW stats), past seasons."""
    return _get(f"element-summary/{element_id}/")


def get_regions() -> list:
    return _get("regions/")


def get_best_private_leagues() -> dict:
    return _get("stats/best-classic-private-leagues/")


def get_element_summaries_parallel(element_ids: list[int]) -> dict[int, dict]:
    """Fetch element-summary for multiple player IDs concurrently."""
    results: dict[int, dict] = {}
    with ThreadPoolExecutor(max_workers=15) as pool:
        futures = {pool.submit(get_element_summary, eid): eid for eid in element_ids}
        for future in as_completed(futures):
            eid = futures[future]
            try:
                results[eid] = future.result()
            except Exception:
                results[eid] = {}
    return results


def get_rival_picks_parallel(entry_ids: list[int], gw: int) -> dict[int, dict]:
    """Fetch GW picks for multiple rivals concurrently."""
    results: dict[int, dict] = {}
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {pool.submit(get_entry_picks, eid, gw): eid for eid in entry_ids}
        for future in as_completed(futures):
            eid = futures[future]
            try:
                results[eid] = future.result()
            except Exception:
                results[eid] = {}
    return results


# ---------------------------------------------------------------------------
# Domain-model builders
# ---------------------------------------------------------------------------

def build_players(bootstrap: dict) -> list[Player]:
    team_map = {t["id"]: t["name"] for t in bootstrap["teams"]}
    players = []
    def _f(val, default=0.0):
        try:
            return float(val) if val not in (None, "") else default
        except (ValueError, TypeError):
            return default

    def _i(val, default=0):
        try:
            return int(val) if val not in (None, "") else default
        except (ValueError, TypeError):
            return default

    for el in bootstrap["elements"]:
        players.append(
            Player(
                id=el["id"],
                web_name=el["web_name"],
                first_name=el["first_name"],
                second_name=el["second_name"],
                team_id=el["team"],
                team_name=team_map.get(el["team"], "Unknown"),
                position=el["element_type"],
                cost=el["now_cost"],
                selected_by_percent=_f(el.get("selected_by_percent")),
                ict_index=_f(el.get("ict_index")),
                form=_f(el.get("form")),
                total_points=el.get("total_points", 0),
                minutes=el.get("minutes", 0),
                goals_scored=el.get("goals_scored", 0),
                assists=el.get("assists", 0),
                clean_sheets=el.get("clean_sheets", 0),
                yellow_cards=el.get("yellow_cards", 0),
                news=el.get("news", ""),
                status=el.get("status", "a"),
                chance_next=_i(el.get("chance_of_playing_next_round"), 100),
                starts=_i(el.get("starts")),
                xg_per_90=_f(el.get("expected_goals_per_90")),
                xa_per_90=_f(el.get("expected_assists_per_90")),
                xgi_per_90=_f(el.get("expected_goal_involvements_per_90")),
                xgc_per_90=_f(el.get("expected_goals_conceded_per_90")),
                def_contrib_per_90=_f(el.get("defensive_contribution_per_90")),
                saves=_i(el.get("saves")),
                bps=_i(el.get("bps")),
                bonus=_i(el.get("bonus")),
                points_per_game=_f(el.get("points_per_game")),
                ep_next=_f(el.get("ep_next")),
            )
        )
    return players


def get_current_gw(bootstrap: dict) -> int:
    for event in bootstrap["events"]:
        if event.get("is_current"):
            return event["id"]
    # Fallback: find the next event
    for event in bootstrap["events"]:
        if event.get("is_next"):
            return event["id"]
    return 1


def build_squad_from_picks(
    picks_data: dict,
    player_map: dict[int, Player],
) -> Squad:
    """Build a Squad from an entry's picks response."""
    player_ids = [p["element"] for p in picks_data.get("picks", [])]
    players = [player_map[pid] for pid in player_ids if pid in player_map]
    total_cost = sum(p.cost for p in players)
    return Squad(players=players, total_cost=total_cost)


def build_rival_entries(league_id: int, top_n: int = 10) -> list[RivalEntry]:
    """Fetch the top N managers from a mini-league."""
    data = get_league_standings(league_id)
    standings = data.get("standings", {}).get("results", [])[:top_n]
    rivals = []
    for entry in standings:
        rivals.append(
            RivalEntry(
                entry_id=entry["entry"],
                player_name=entry["player_name"],
                team_name=entry["entry_name"],
                rank=entry["rank"],
                gw_points=entry.get("event_total", 0),
                total_points=entry["total"],
            )
        )
    return rivals


def enrich_rivals_with_picks(
    rivals: list[RivalEntry],
    gw: int,
) -> list[RivalEntry]:
    """Attach this GW's picks to each rival."""
    entry_ids = [r.entry_id for r in rivals]
    picks_map = get_rival_picks_parallel(entry_ids, gw)
    for rival in rivals:
        raw = picks_map.get(rival.entry_id, {})
        rival.picks = [p["element"] for p in raw.get("picks", [])]
    return rivals
