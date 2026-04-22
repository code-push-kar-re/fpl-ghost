"""Linear programming squad optimizer using PuLP."""

from typing import Optional

import pulp

import config
from models import Player, Squad, Transfer


def _make_player_map(players: list[Player]) -> dict[int, Player]:
    return {p.id: p for p in players}


def build_squad(
    players: list[Player],
    budget: int = config.BUDGET_DEFAULT,
    horizon_gws: int = 3,
    locked_in: Optional[list[int]] = None,
    excluded: Optional[list[int]] = None,
    rival_boost: float = 0.0,     # extra weight for differentials
) -> Squad:
    """
    Solve the 15-man squad selection LP.
    Objective: maximise sum(xP_horizon) with optional differential boost for low-LEO players.
    """
    locked_in = set(locked_in or [])
    excluded = set(excluded or [])
    eligible = [p for p in players if p.id not in excluded and p.cost <= budget]

    prob = pulp.LpProblem("squad_select", pulp.LpMaximize)
    x = {p.id: pulp.LpVariable(f"x_{p.id}", cat="Binary") for p in eligible}

    # Objective: xP_horizon + rival_boost for differentials (low LEO players)
    def obj_weight(p: Player) -> float:
        base = p.xP_horizon if p.xP_horizon > 0 else p.xP
        diff_bonus = rival_boost * (1.0 - p.leo) if rival_boost > 0 else 0.0
        return base + diff_bonus

    prob += pulp.lpSum(obj_weight(p) * x[p.id] for p in eligible)

    # Squad size
    prob += pulp.lpSum(x[p.id] for p in eligible) == config.SQUAD_SIZE

    # Budget
    prob += pulp.lpSum(p.cost * x[p.id] for p in eligible) <= budget

    # Position quotas
    for pos, count in config.POSITION_COUNTS.items():
        prob += pulp.lpSum(x[p.id] for p in eligible if p.position == pos) == count

    # Max 3 per club
    teams = {p.team_id for p in eligible}
    for team_id in teams:
        prob += pulp.lpSum(x[p.id] for p in eligible if p.team_id == team_id) <= config.MAX_PER_TEAM

    # Lock-in constraints
    for pid in locked_in:
        if pid in x:
            prob += x[pid] == 1

    prob.solve(pulp.PULP_CBC_CMD(msg=False))

    selected = [p for p in eligible if pulp.value(x[p.id]) == 1]
    total_cost = sum(p.cost for p in selected)
    return Squad(players=selected, total_cost=total_cost)


def optimize_xi(squad: Squad) -> tuple[list[Player], list[Player]]:
    """
    Pick the best 11 from 15.  Returns (starting_xi, bench) sorted by position.
    Uses LP to maximise xP of starting xi subject to formation legality.
    """
    players = squad.players
    prob = pulp.LpProblem("xi_select", pulp.LpMaximize)
    y = {p.id: pulp.LpVariable(f"y_{p.id}", cat="Binary") for p in players}

    prob += pulp.lpSum(p.xP * y[p.id] for p in players)

    # Exactly 11 starters
    prob += pulp.lpSum(y[p.id] for p in players) == 11

    # Exactly 1 GK starts
    gks = [p for p in players if p.position == 1]
    prob += pulp.lpSum(y[p.id] for p in gks) == 1

    # Outfield formation: 3–5 DEF, 2–5 MID, 1–3 FWD
    defs = [p for p in players if p.position == 2]
    mids = [p for p in players if p.position == 3]
    fwds = [p for p in players if p.position == 4]

    prob += pulp.lpSum(y[p.id] for p in defs) >= 3
    prob += pulp.lpSum(y[p.id] for p in defs) <= 5
    prob += pulp.lpSum(y[p.id] for p in mids) >= 2
    prob += pulp.lpSum(y[p.id] for p in mids) <= 5
    prob += pulp.lpSum(y[p.id] for p in fwds) >= 1
    prob += pulp.lpSum(y[p.id] for p in fwds) <= 3

    prob.solve(pulp.PULP_CBC_CMD(msg=False))

    starting_ids = {p.id for p in players if pulp.value(y[p.id]) == 1}
    starting = [p for p in players if p.id in starting_ids]
    bench = [p for p in players if p.id not in starting_ids]

    # Sort: GK first, then by position then xP desc
    def sort_key(p: Player):
        return (p.position, -p.xP)

    starting.sort(key=sort_key)
    bench.sort(key=sort_key)
    return starting, bench


def recommend_transfers(
    current_squad: Squad,
    all_players: list[Player],
    n_free_transfers: int = 1,
    n_transfers: int = 1,
    rival_boost: float = 0.5,
) -> list[Transfer]:
    """
    Find the best n_transfers by comparing every valid swap.
    Simple heuristic: swap out the lowest xP_horizon player at each position,
    swap in the highest xP_horizon player that fits budget and constraints.
    Returns a list of Transfer objects.
    """
    transfers: list[Transfer] = []
    current_ids = set(current_squad.player_ids())
    remaining_budget = current_squad.budget_remaining

    squad_copy = list(current_squad.players)

    for _ in range(n_transfers):
        best: Optional[Transfer] = None

        for out_p in squad_copy:
            freed = out_p.cost + remaining_budget
            candidates = [
                p for p in all_players
                if p.id not in {pl.id for pl in squad_copy}
                and p.position == out_p.position
                and p.cost <= freed
                and _team_count(squad_copy, p.team_id, exclude_id=out_p.id) < config.MAX_PER_TEAM
            ]
            for in_p in candidates:
                # Weight by differential: low LEO high xP bonus
                diff_bonus = rival_boost * (1.0 - in_p.leo) - rival_boost * (1.0 - out_p.leo)
                gain = (in_p.xP_horizon - out_p.xP_horizon) + diff_bonus
                if best is None or gain > best.xp_gain:
                    best = Transfer(
                        player_out=out_p,
                        player_in=in_p,
                        xp_gain=gain,
                        cost_delta=out_p.cost - in_p.cost,
                    )

        if best is None:
            break

        transfers.append(best)
        squad_copy = [p for p in squad_copy if p.id != best.player_out.id]
        squad_copy.append(best.player_in)
        remaining_budget += best.cost_delta

    return transfers


def _team_count(squad: list[Player], team_id: int, exclude_id: Optional[int] = None) -> int:
    return sum(
        1 for p in squad
        if p.team_id == team_id and p.id != exclude_id
    )
