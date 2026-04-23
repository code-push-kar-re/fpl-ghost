"""
GW lineup optimizer — picks the best 11 from a 15-player squad for a given GW.

Uses PuLP integer programming (already a dependency).
Falls back to a greedy heuristic if PuLP is unavailable.

Inputs: list of squad player dicts (design-shape, with xpByGw array).
Output: {xi_ids, captain_id, vice_id, total_xp} per GW.
"""
from __future__ import annotations

try:
    from pulp import (
        LpProblem, LpVariable, LpMaximize, lpSum,
        LpBinary, value as lp_value, PULP_CBC_CMD,
    )
    _PULP_OK = True
except ImportError:
    _PULP_OK = False


def _gw_xp(player: dict, gw: int) -> float:
    """Return the expected points for player in a specific GW."""
    entry = next((g for g in (player.get("xpByGw") or []) if g["gw"] == gw), None)
    return float(entry["xp"]) if entry else float(player.get("proj", 0.0))


def optimize_squad_for_gw(squad_15: list[dict], gw: int) -> dict:
    """
    Select optimal XI + captain from 15-player squad for a given GW.

    Returns:
        xi_ids     — set of player id strings playing in the XI
        captain_id — player id string (highest xP starter, points doubled)
        vice_id    — player id string (second-highest xP starter)
        total_xp   — float (XI sum including captain double)
    """
    if not squad_15:
        return {"xi_ids": set(), "captain_id": None, "vice_id": None, "total_xp": 0.0}

    if _PULP_OK:
        return _lp_optimize(squad_15, gw)
    return _greedy_fallback(squad_15, gw)


def _lp_optimize(squad_15: list[dict], gw: int) -> dict:
    n        = len(squad_15)
    ids      = [p["id"] for p in squad_15]
    positions = [p["pos"] for p in squad_15]      # 1=GK 2=DEF 3=MID 4=FWD
    xps      = [_gw_xp(p, gw) for p in squad_15]

    prob = LpProblem(f"fpl_xi_gw{gw}", LpMaximize)
    x = [LpVariable(f"x{i}", cat=LpBinary) for i in range(n)]  # 1 = in XI
    c = [LpVariable(f"c{i}", cat=LpBinary) for i in range(n)]  # 1 = captain

    # Objective: xP sum + captain bonus (doubles captain's xP)
    prob += lpSum(xps[i] * x[i] for i in range(n)) + lpSum(xps[i] * c[i] for i in range(n))

    prob += lpSum(x) == 11                       # exactly 11 in XI
    prob += lpSum(c) == 1                        # exactly 1 captain
    for i in range(n):
        prob += c[i] <= x[i]                     # captain must be in XI

    gks  = [i for i, pos in enumerate(positions) if pos == 1]
    defs = [i for i, pos in enumerate(positions) if pos == 2]
    mids = [i for i, pos in enumerate(positions) if pos == 3]
    fwds = [i for i, pos in enumerate(positions) if pos == 4]

    prob += lpSum(x[i] for i in gks)  == 1
    prob += lpSum(x[i] for i in defs) >= 3
    prob += lpSum(x[i] for i in defs) <= 5
    prob += lpSum(x[i] for i in mids) >= 2
    prob += lpSum(x[i] for i in mids) <= 5
    prob += lpSum(x[i] for i in fwds) >= 1
    prob += lpSum(x[i] for i in fwds) <= 3

    prob.solve(PULP_CBC_CMD(msg=0))

    xi_ids     = {ids[i] for i in range(n) if (lp_value(x[i]) or 0) > 0.5}
    captain_id = next((ids[i] for i in range(n) if (lp_value(c[i]) or 0) > 0.5), None)
    return _finalise(squad_15, xi_ids, captain_id, gw, xps, ids)


def _greedy_fallback(squad_15: list[dict], gw: int) -> dict:
    """Simple greedy selection when PuLP is unavailable."""
    ordered = sorted(squad_15, key=lambda p: -_gw_xp(p, gw))
    xi, counts = [], {1: 0, 2: 0, 3: 0, 4: 0}
    for p in ordered:
        if len(xi) >= 11:
            break
        pos = p["pos"]
        if pos == 1 and counts[1] >= 1: continue
        if pos == 2 and counts[2] >= 5: continue
        if pos == 3 and counts[3] >= 5: continue
        if pos == 4 and counts[4] >= 3: continue
        xi.append(p)
        counts[pos] += 1
    xi_ids = {p["id"] for p in xi}
    ids  = [p["id"] for p in squad_15]
    xps  = [_gw_xp(p, gw) for p in squad_15]
    return _finalise(squad_15, xi_ids, None, gw, xps, ids)


def _finalise(
    squad_15: list[dict],
    xi_ids: set,
    captain_id,
    gw: int,
    xps: list[float],
    ids: list[str],
) -> dict:
    xi_players = [(p, _gw_xp(p, gw)) for p in squad_15 if p["id"] in xi_ids]
    xi_players.sort(key=lambda t: -t[1])

    if captain_id is None and xi_players:
        captain_id = xi_players[0][0]["id"]
    vice_id = next(
        (p["id"] for p, _ in xi_players if p["id"] != captain_id),
        captain_id,
    )

    cap_xp   = next((xp for pid, xp in zip(ids, xps) if pid == captain_id), 0.0)
    total_xp = sum(_gw_xp(p, gw) for p in squad_15 if p["id"] in xi_ids) + cap_xp

    return {
        "xi_ids":     xi_ids,
        "captain_id": captain_id,
        "vice_id":    vice_id,
        "total_xp":   round(total_xp, 2),
    }


def build_optimal_lineups(squad_15: list[dict], gws: list[int]) -> dict:
    """
    Run optimizer for each GW.
    Returns {gw: {xi_ids, captain_id, vice_id, total_xp}}.
    """
    return {gw: optimize_squad_for_gw(squad_15, gw) for gw in gws}
