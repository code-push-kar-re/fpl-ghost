"""
Team-level xP over a multi-GW horizon with rotation and captaincy.

Given a 15-man squad and the per-GW xP matrix:
  - For each GW, pick the best legal XI (LP)
  - Choose the captain (highest xP in the XI) — doubled points
  - Sum (XI_xP + captain_bonus) across GWs

This is what lets the optimizer value a player who has 3 great fixtures
but 2 blanks — you'd just bench them those weeks.
"""

from dataclasses import dataclass

import pulp

import config
from models import Player, Squad


@dataclass
class GWPlan:
    gw: int
    starting_xi: list[Player]
    bench: list[Player]
    captain: Player
    vice_captain: Player
    formation: str
    xi_xp: float
    captain_bonus: float
    total_xp: float


@dataclass
class HorizonPlan:
    gws: list[GWPlan]
    total_xp: float

    def to_table(self) -> list[dict]:
        rows = []
        for plan in self.gws:
            rows.append({
                "GW": plan.gw,
                "Formation": plan.formation,
                "Captain": plan.captain.web_name,
                "Vice": plan.vice_captain.web_name,
                "XI xP": round(plan.xi_xp, 2),
                "Capt Bonus": round(plan.captain_bonus, 2),
                "Total xP": round(plan.total_xp, 2),
            })
        return rows


# ---------------------------------------------------------------------------
# Per-GW XI optimizer — uses that GW's xP
# ---------------------------------------------------------------------------

def optimize_xi_for_gw(
    squad_players: list[Player],
    gw: int,
) -> tuple[list[Player], list[Player], str]:
    """
    Pick best 11 from 15 given each player's xP for this GW.
    Returns (xi, bench, formation_label).
    """
    # Pull that GW's xP from each player's dict
    xp_map = {p.id: p.xP_by_gw.get(gw, 0.0) for p in squad_players}

    prob = pulp.LpProblem(f"xi_gw{gw}", pulp.LpMaximize)
    y = {p.id: pulp.LpVariable(f"y_{p.id}", cat="Binary") for p in squad_players}

    prob += pulp.lpSum(xp_map[p.id] * y[p.id] for p in squad_players)
    prob += pulp.lpSum(y[p.id] for p in squad_players) == 11

    gks = [p for p in squad_players if p.position == 1]
    defs = [p for p in squad_players if p.position == 2]
    mids = [p for p in squad_players if p.position == 3]
    fwds = [p for p in squad_players if p.position == 4]

    prob += pulp.lpSum(y[p.id] for p in gks) == 1
    prob += pulp.lpSum(y[p.id] for p in defs) >= 3
    prob += pulp.lpSum(y[p.id] for p in defs) <= 5
    prob += pulp.lpSum(y[p.id] for p in mids) >= 2
    prob += pulp.lpSum(y[p.id] for p in mids) <= 5
    prob += pulp.lpSum(y[p.id] for p in fwds) >= 1
    prob += pulp.lpSum(y[p.id] for p in fwds) <= 3

    prob.solve(pulp.PULP_CBC_CMD(msg=False))

    xi_ids = {p.id for p in squad_players if pulp.value(y[p.id]) == 1}
    xi = [p for p in squad_players if p.id in xi_ids]
    bench = [p for p in squad_players if p.id not in xi_ids]

    # Formation label
    xi_defs = sum(1 for p in xi if p.position == 2)
    xi_mids = sum(1 for p in xi if p.position == 3)
    xi_fwds = sum(1 for p in xi if p.position == 4)
    formation = f"{xi_defs}-{xi_mids}-{xi_fwds}"

    # Sort outputs
    xi.sort(key=lambda p: (p.position, -xp_map[p.id]))
    bench.sort(key=lambda p: (p.position, -xp_map[p.id]))
    return xi, bench, formation


# ---------------------------------------------------------------------------
# Horizon planner
# ---------------------------------------------------------------------------

def plan_horizon(
    squad: Squad,
    start_gw: int,
    horizon: int,
    captain_mult: float = 2.0,
) -> HorizonPlan:
    """
    For each GW in [start_gw, start_gw+horizon), pick optimal XI + captain.
    Returns a HorizonPlan with per-GW breakdown and total xP.
    """
    gw_plans: list[GWPlan] = []
    grand_total = 0.0

    for gw in range(start_gw, start_gw + horizon):
        xi, bench, formation = optimize_xi_for_gw(squad.players, gw)
        xp_map = {p.id: p.xP_by_gw.get(gw, 0.0) for p in xi}

        # XI xP
        xi_xp = sum(xp_map.values())

        # Captain = highest xP in XI; vice = 2nd
        xi_sorted = sorted(xi, key=lambda p: xp_map[p.id], reverse=True)
        captain = xi_sorted[0] if xi_sorted else None
        vice = xi_sorted[1] if len(xi_sorted) > 1 else captain

        if captain is None:
            continue

        # Captain doubles their points (bonus = 1x extra since they already count once)
        captain_bonus = xp_map[captain.id] * (captain_mult - 1.0)
        total = xi_xp + captain_bonus
        grand_total += total

        gw_plans.append(GWPlan(
            gw=gw,
            starting_xi=xi,
            bench=bench,
            captain=captain,
            vice_captain=vice,
            formation=formation,
            xi_xp=xi_xp,
            captain_bonus=captain_bonus,
            total_xp=total,
        ))

    return HorizonPlan(gws=gw_plans, total_xp=round(grand_total, 2))


# ---------------------------------------------------------------------------
# Transfer scoring using horizon team xP
# ---------------------------------------------------------------------------

def evaluate_transfer_on_horizon(
    squad: Squad,
    player_out: Player,
    player_in: Player,
    start_gw: int,
    horizon: int,
) -> float:
    """
    Compare horizon team-xP: squad as-is vs. squad with one swap.
    Returns delta (positive = improvement).
    """
    baseline = plan_horizon(squad, start_gw, horizon).total_xp

    swapped_players = [p for p in squad.players if p.id != player_out.id] + [player_in]
    new_cost = squad.total_cost - player_out.cost + player_in.cost
    new_squad = Squad(players=swapped_players, total_cost=new_cost)

    new_total = plan_horizon(new_squad, start_gw, horizon).total_xp
    return new_total - baseline
