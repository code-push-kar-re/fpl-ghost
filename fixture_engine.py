"""Per-team fixture schedule lookups for multi-GW horizon projection."""

from dataclasses import dataclass
from typing import Optional

import fpl_api


@dataclass
class TeamFixture:
    gw: int
    opponent_id: int
    opponent_name: str
    is_home: bool
    fdr: int           # Fixture Difficulty Rating 2..5 (FPL provides 1..5)
    kickoff_time: Optional[str]


def build_team_schedule(
    bootstrap: dict,
    start_gw: int,
    horizon: int = 5,
) -> dict[int, list[TeamFixture]]:
    """
    Returns {team_id: [TeamFixture, ...]} covering GW start_gw..start_gw+horizon-1.
    Handles double gameweeks (multiple fixtures per GW) and blanks (empty list for that GW).
    """
    fixtures = fpl_api.get_fixtures()
    team_map = {t["id"]: t["name"] for t in bootstrap["teams"]}

    schedule: dict[int, list[TeamFixture]] = {tid: [] for tid in team_map}
    target_gws = set(range(start_gw, start_gw + horizon))

    for fx in fixtures:
        gw = fx.get("event")
        if gw not in target_gws:
            continue
        h, a = fx["team_h"], fx["team_a"]
        kickoff = fx.get("kickoff_time")

        schedule[h].append(TeamFixture(
            gw=gw, opponent_id=a, opponent_name=team_map.get(a, "?"),
            is_home=True, fdr=fx.get("team_h_difficulty", 3), kickoff_time=kickoff,
        ))
        schedule[a].append(TeamFixture(
            gw=gw, opponent_id=h, opponent_name=team_map.get(h, "?"),
            is_home=False, fdr=fx.get("team_a_difficulty", 3), kickoff_time=kickoff,
        ))

    for tid in schedule:
        schedule[tid].sort(key=lambda f: (f.gw, f.kickoff_time or ""))

    return schedule


def fixtures_by_gw(team_schedule: list[TeamFixture]) -> dict[int, list[TeamFixture]]:
    """Group a team's fixtures by GW (handles DGWs)."""
    grouped: dict[int, list[TeamFixture]] = {}
    for f in team_schedule:
        grouped.setdefault(f.gw, []).append(f)
    return grouped
