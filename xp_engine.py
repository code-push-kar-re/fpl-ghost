"""
xP derivation engine — v2 with element-summary refinement.

Improvement over v1:
  - Minutes calibration: last-5-match average from element-summary history
    (vs season-long average) to capture rotation changes and returning players.
  - Form-weighted xGI: 60% last-5 / 40% season average.
  - Fixture list: element-summary upcoming fixtures used directly (accurate
    DGW/BGW, correct FDR, home/away) — overrides our schedule-engine when available.
  - Penalty proxy: if player.goals_scored > player.xg_per_90 * starts * 1.5,
    flag as likely penalty taker (+0.4 pts penalty-kick bonus).


Derives expected points per player per GW from FPL's underlying stats
(xG/90, xA/90, xGC/90, minutes, starts, defensive contribution) combined
with fixture difficulty.

Outputs:
  - player.xP                         next-GW xP
  - player.xP_horizon                 sum over horizon GWs
  - player.xP_by_gw                   {gw: xP} dict for rotation logic

Model formula (per player, per GW):

  xP = P(plays) * [
         appearance_pts
       + xGI_per90 * (exp_mins/90) * goal_pts_weighted * fdr_att_mult
       + xA_per90  * (exp_mins/90) * 3                   * fdr_att_mult    # (approximate — xGI already splits)
       + position_cs_pts * P(clean_sheet | FDR, home_adv)
       + def_contrib_bonus
       + saves_bonus                              (GK only)
       - gc_penalty * expected_gc * fdr_gc_mult   (GK/DEF only)
       + bonus_pts_proxy
       ]

Fixture multipliers are asymmetric for attack vs. clean-sheet probability
because a tough opponent suppresses CS probability more than it suppresses
a striker's goal rate.
"""

from dataclasses import dataclass, field
from typing import Optional

import pandas as pd

import config
from models import Player
from fixture_engine import TeamFixture, build_team_schedule, fixtures_by_gw


# ---------------------------------------------------------------------------
# Element-summary enrichment types
# ---------------------------------------------------------------------------

@dataclass
class ElementData:
    """Parsed element-summary data for one player."""
    player_id: int
    # Per-match history: list of {round, minutes, xGI, xGC}
    history: list[dict] = field(default_factory=list)
    # Upcoming fixtures from the API: list of {event(gw), difficulty, is_home}
    upcoming: list[dict] = field(default_factory=list)

    @property
    def recent_minutes_avg(self) -> Optional[float]:
        """Average minutes over last 5 played matches."""
        played = [h for h in self.history if h["minutes"] > 0][-5:]
        if not played:
            return None
        return sum(h["minutes"] for h in played) / len(played)

    @property
    def recent_start_rate(self) -> float:
        """Fraction of last 5 matches where player started (≥45 min)."""
        played = [h for h in self.history if h["minutes"] > 0][-5:]
        if not played:
            return 1.0
        return sum(1 for h in played if h["minutes"] >= 45) / len(played)

    @property
    def recent_xgi_per90(self) -> Optional[float]:
        """xGI/90 from last 5 played matches — more responsive than season avg."""
        played = [h for h in self.history if h["minutes"] > 0][-5:]
        if not played:
            return None
        total_mins = sum(h["minutes"] for h in played)
        if total_mins <= 0:
            return None
        total_xgi = sum(float(h.get("xgi", 0)) for h in played)
        return total_xgi / (total_mins / 90.0)

    def fixtures_for_gw(self, gw: int) -> list[dict]:
        """Upcoming fixtures for a specific GW (handles DGW/BGW)."""
        return [f for f in self.upcoming if f["event"] == gw]


def parse_element_data(player_id: int, raw: dict) -> ElementData:
    """Convert raw element-summary API response into ElementData."""
    history = []
    for h in raw.get("history", []):
        history.append({
            "round": h["round"],
            "minutes": h["minutes"],
            "xgi": float(h.get("expected_goal_involvements") or 0),
            "xgc": float(h.get("expected_goals_conceded") or 0),
            "goals": h.get("goals_scored", 0),
            "assists": h.get("assists", 0),
            "bps": h.get("bps", 0),
        })
    upcoming = []
    for f in raw.get("fixtures", []):
        if f.get("event") is None:
            continue
        upcoming.append({
            "event": f["event"],
            "difficulty": f["difficulty"],
            "is_home": f["is_home"],
            "finished": f.get("finished", False),
        })
    return ElementData(player_id=player_id, history=history, upcoming=upcoming)


# ---------------------------------------------------------------------------
# Position-specific scoring
# ---------------------------------------------------------------------------

POS_GOAL_PTS = {1: 10, 2: 6, 3: 5, 4: 4}        # GK scores on goal: 10 pts
POS_CS_PTS   = {1: 4,  2: 4, 3: 1, 4: 0}
POS_ASSIST_PTS = 3                               # all positions


# ---------------------------------------------------------------------------
# Fixture difficulty multipliers (FDR 2..5; FDR 1 treated as 2 floor)
# ---------------------------------------------------------------------------

# Attacking output scaling: easy fixture => more goals/assists
FDR_ATT_MULT = {2: 1.25, 3: 1.00, 4: 0.80, 5: 0.65}

# Clean sheet probability by FDR (baseline home; away adjusted in code)
FDR_CS_PROB = {2: 0.45, 3: 0.30, 4: 0.18, 5: 0.08}

# Goals conceded scaling (worse fixture = more conceded)
FDR_GC_MULT = {2: 0.75, 3: 1.00, 4: 1.35, 5: 1.70}

HOME_CS_BOOST = 1.15
AWAY_CS_PENALTY = 0.85
HOME_ATT_BOOST = 1.08
AWAY_ATT_PENALTY = 0.94


# ---------------------------------------------------------------------------
# Core per-player, per-fixture xP calculation
# ---------------------------------------------------------------------------

def _minutes_probability(player: Player, el: Optional["ElementData"] = None) -> float:
    """Probability player features meaningfully this GW."""
    if player.status in ("i", "s", "u"):
        return 0.0
    if player.status == "d":
        base = player.chance_next / 100.0 if player.chance_next else 0.5
    else:
        base = player.chance_next / 100.0 if player.chance_next else 1.0

    if el is not None:
        # Use recent start rate from last 5 matches — captures rotation changes
        base *= el.recent_start_rate
    elif player.starts < 5:
        base *= 0.6
    return max(0.0, min(1.0, base))


def _expected_minutes(player: Player, el: Optional["ElementData"] = None) -> float:
    """Expected minutes per fixture."""
    if el is not None:
        recent = el.recent_minutes_avg
        if recent is not None:
            # Blend: 70% recent (last-5) / 30% season avg — damps one-off anomalies
            games_obs = max(1, player.starts)
            season_avg = player.minutes / games_obs
            blended = 0.7 * recent + 0.3 * season_avg
            return max(0.0, min(90.0, blended))
    games_observed = max(1, player.starts)
    avg_start_min = player.minutes / games_observed if games_observed > 0 else 0
    return max(0.0, min(90.0, avg_start_min * 0.95 + 4.0))


def _effective_xgi_per90(player: Player, el: Optional["ElementData"] = None) -> float:
    """Form-weighted xGI/90: 60% last-5 / 40% season when element data available."""
    season_xgi = player.xgi_per_90
    if el is None:
        return season_xgi
    recent = el.recent_xgi_per90
    if recent is None:
        return season_xgi
    return 0.6 * recent + 0.4 * season_xgi


def _penalty_bonus(player: Player) -> float:
    """Extra pts for likely penalty takers: goals exceed xG significantly."""
    if player.starts < 5:
        return 0.0
    expected_goals = player.xg_per_90 * (player.minutes / 90.0)
    excess = player.goals_scored - expected_goals
    if excess > 2.0:   # scored >2 more goals than xG → strong penalty indicator
        return 0.4
    if excess > 1.0:
        return 0.2
    return 0.0


def _appearance_pts(expected_mins: float) -> float:
    """Appearance points: 1 for any mins, 2 for ≥60."""
    if expected_mins >= 60:
        return 2.0
    if expected_mins >= 1:
        return 1.0
    return 0.0


def _fdr_clamp(fdr: int) -> int:
    return max(2, min(5, fdr))


def _cs_probability(fdr: int, is_home: bool) -> float:
    base = FDR_CS_PROB[_fdr_clamp(fdr)]
    return base * (HOME_CS_BOOST if is_home else AWAY_CS_PENALTY)


def _att_multiplier(fdr: int, is_home: bool) -> float:
    base = FDR_ATT_MULT[_fdr_clamp(fdr)]
    return base * (HOME_ATT_BOOST if is_home else AWAY_ATT_PENALTY)


def _gc_expected(fdr: int) -> float:
    """Expected team goals conceded for this fixture."""
    # Team baseline ~1.3 GC per game; scaled by FDR mult
    return 1.3 * FDR_GC_MULT[_fdr_clamp(fdr)]


def _single_fixture_xp(player: Player, fixture: TeamFixture, el: Optional["ElementData"] = None) -> float:
    """Raw xP for a player in a single fixture (before minutes-prob gating)."""
    pos = player.position
    exp_mins = _expected_minutes(player, el)
    mins_factor = exp_mins / 90.0

    # --- Appearance ---
    app_pts = _appearance_pts(exp_mins)

    # --- Goals & assists from form-weighted xGI/90 ---
    att_mult = _att_multiplier(fixture.fdr, fixture.is_home)
    xgi = _effective_xgi_per90(player, el) * mins_factor
    if xgi > 0 and (player.xg_per_90 + player.xa_per_90) > 0:
        goal_share = player.xg_per_90 / (player.xg_per_90 + player.xa_per_90)
    else:
        goal_share = 0.7 if pos == 4 else (0.5 if pos == 3 else 0.3)

    goals_pts = xgi * goal_share * POS_GOAL_PTS[pos] * att_mult
    assists_pts = xgi * (1 - goal_share) * POS_ASSIST_PTS * att_mult

    # --- Clean sheet ---
    cs_pts = POS_CS_PTS[pos] * _cs_probability(fixture.fdr, fixture.is_home)

    # --- Defensive contribution (DEF: threshold 10 CBIT; MID/FWD: 12) ---
    # FPL awards 2 pts per game when threshold hit. def_contrib_per_90 >= 10 (DEF) → prob~1
    if pos == 2:
        def_prob = min(1.0, player.def_contrib_per_90 / 10.0)
    elif pos in (3, 4):
        def_prob = min(1.0, player.def_contrib_per_90 / 12.0)
    else:
        def_prob = 0.0
    def_pts = 2.0 * def_prob * mins_factor

    # --- Saves (GK only) ---
    saves_pts = 0.0
    if pos == 1 and player.minutes > 0:
        saves_per_90 = (player.saves / (player.minutes / 90.0))
        saves_pts = (saves_per_90 / 3.0) * mins_factor  # 1 pt per 3 saves

    # --- Goals conceded penalty (GK/DEF) ---
    gc_pts = 0.0
    if pos in (1, 2):
        exp_gc = _gc_expected(fixture.fdr)
        gc_pts = -(exp_gc / 2.0)   # -1 per 2 conceded

    # --- Bonus points proxy (BPS-based) ---
    # Top BPS ~800 over ~33 games -> ~24 per game; bonus avg ~0.4 pts per game for elites
    games_played = max(1, player.starts + 1)
    bps_per_game = player.bps / games_played
    bonus_proxy = min(1.2, bps_per_game / 40.0)  # cap at 1.2 pts

    penalty_pts = _penalty_bonus(player)

    raw_xp = (
        app_pts
        + goals_pts
        + assists_pts
        + cs_pts
        + def_pts
        + saves_pts
        + gc_pts
        + bonus_proxy
        + penalty_pts
    )
    return max(0.0, raw_xp)


def _player_xp_for_gw(
    player: Player,
    gw_fixtures: list[TeamFixture],
    el: Optional["ElementData"] = None,
) -> float:
    """Sum of xP across all fixtures in a GW (handles DGW/blanks)."""
    if not gw_fixtures:
        return 0.0
    mins_prob = _minutes_probability(player, el)
    if mins_prob <= 0:
        return 0.0
    total = sum(_single_fixture_xp(player, f, el) for f in gw_fixtures)
    return total * mins_prob


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _element_fixtures_to_team_fixtures(el: "ElementData", gw: int) -> list[TeamFixture]:
    """Convert element-summary upcoming fixtures for a GW into TeamFixture objects."""
    out = []
    for f in el.fixtures_for_gw(gw):
        if f.get("finished"):
            continue
        out.append(TeamFixture(
            gw=gw,
            opponent_id=0,
            opponent_name="",
            is_home=f["is_home"],
            fdr=max(2, min(5, f["difficulty"])),
            kickoff_time="",
        ))
    return out


def build_xp_matrix(
    players: list[Player],
    bootstrap: dict,
    start_gw: int,
    horizon: int = 5,
    element_data: Optional[dict[int, "ElementData"]] = None,
) -> pd.DataFrame:
    """
    Returns a DataFrame: index=player_id, columns=['gw_{n}' ...], values=derived xP.
    Also populates player.xP (next GW), player.xP_horizon, and player.xP_by_gw.

    element_data: optional {player_id: ElementData} — when present, uses real per-match
    history for minutes calibration and real upcoming fixture list for FDR/home-away.
    """
    schedule = build_team_schedule(bootstrap, start_gw, horizon)

    rows: dict[int, dict] = {}
    gw_cols = [f"gw_{g}" for g in range(start_gw, start_gw + horizon)]

    for p in players:
        el = element_data.get(p.id) if element_data else None
        team_fixtures = schedule.get(p.team_id, [])
        by_gw = fixtures_by_gw(team_fixtures)

        row = {}
        p.xP_by_gw = {}
        for g in range(start_gw, start_gw + horizon):
            # Prefer real fixture list from element-summary when available
            if el and el.upcoming:
                gw_fixtures = _element_fixtures_to_team_fixtures(el, g)
                if not gw_fixtures and g == start_gw:
                    # fallback to schedule engine for current GW (may already be live)
                    gw_fixtures = by_gw.get(g, [])
            else:
                gw_fixtures = by_gw.get(g, [])

            xp = _player_xp_for_gw(p, gw_fixtures, el)
            row[f"gw_{g}"] = round(xp, 3)
            p.xP_by_gw[g] = round(xp, 3)

        p.xP = row.get(f"gw_{start_gw}", 0.0)
        p.xP_horizon = round(sum(row.values()), 3)
        rows[p.id] = row

    df = pd.DataFrame.from_dict(rows, orient="index", columns=gw_cols)
    df.index.name = "player_id"
    return df


def enrich_players_with_xp(
    players: list[Player],
    bootstrap: dict,
    start_gw: int,
    horizon_gws: int = 3,
    element_data: Optional[dict[int, "ElementData"]] = None,
) -> tuple[list[Player], str]:
    """Main entry. Derives xP per GW from FPL stats + fixtures."""
    build_xp_matrix(players, bootstrap, start_gw, horizon_gws, element_data=element_data)
    if element_data:
        source = f"Derived model v2 (element-summary history + xGI form-weighted × FDR), horizon={horizon_gws} GWs"
    else:
        source = f"Derived model v1 (season xGI/90 × FDR × minutes-prob), horizon={horizon_gws} GWs"
    return players, source


def compute_leo(
    players: list[Player],
    rival_picks: list[list[int]],
) -> None:
    """League Effective Ownership across rivals."""
    n = len(rival_picks)
    if n == 0:
        return
    cnt: dict[int, int] = {}
    for picks in rival_picks:
        for pid in picks:
            cnt[pid] = cnt.get(pid, 0) + 1
    for p in players:
        p.leo = cnt.get(p.id, 0) / n
