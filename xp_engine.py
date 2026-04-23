"""
xP derivation engine — v3 with team strength + home/away form + historical rates.

Improvements over v2:
  - Team strength matchup: FPL bootstrap strength_attack/defence per team replaces
    raw FDR as the primary multiplier. e.g. Salah (LIV attack_home=1380) vs
    Wolves defence_away (960) gives a meaningful ratio vs a generic FDR=2.
  - Player home/away form: was_home extracted from element-summary history. Players
    who significantly over/under-perform at home vs away get a personal split factor.
  - Historical goal rates: finished fixture scores used to calibrate CS probability
    and expected goals conceded (instead of FDR-lookup table only).
  - FDR still used as 40% weight fallback when strength data is unavailable.
"""

from __future__ import annotations
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
    history: list[dict] = field(default_factory=list)
    upcoming: list[dict] = field(default_factory=list)

    @property
    def recent_minutes_avg(self) -> Optional[float]:
        played = [h for h in self.history if h["minutes"] > 0][-5:]
        if not played:
            return None
        return sum(h["minutes"] for h in played) / len(played)

    @property
    def recent_start_rate(self) -> float:
        played = [h for h in self.history if h["minutes"] > 0][-5:]
        if not played:
            return 1.0
        return sum(1 for h in played if h["minutes"] >= 45) / len(played)

    @property
    def recent_xgi_per90(self) -> Optional[float]:
        played = [h for h in self.history if h["minutes"] > 0][-5:]
        if not played:
            return None
        total_mins = sum(h["minutes"] for h in played)
        if total_mins <= 0:
            return None
        return sum(float(h.get("xgi", 0)) for h in played) / (total_mins / 90.0)

    @property
    def home_xgi_per90(self) -> Optional[float]:
        """xGI/90 from home matches only (last 10 played)."""
        home = [h for h in self.history if h["minutes"] > 0 and h.get("was_home", True)][-10:]
        if not home:
            return None
        mins = sum(h["minutes"] for h in home)
        return sum(float(h.get("xgi", 0)) for h in home) / (mins / 90.0) if mins > 0 else None

    @property
    def away_xgi_per90(self) -> Optional[float]:
        """xGI/90 from away matches only (last 10 played)."""
        away = [h for h in self.history if h["minutes"] > 0 and not h.get("was_home", True)][-10:]
        if not away:
            return None
        mins = sum(h["minutes"] for h in away)
        return sum(float(h.get("xgi", 0)) for h in away) / (mins / 90.0) if mins > 0 else None

    def fixtures_for_gw(self, gw: int) -> list[dict]:
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
            "was_home": bool(h.get("was_home", True)),
            "opponent_team": h.get("opponent_team", 0),
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
            "team_h": f.get("team_h"),
            "team_a": f.get("team_a"),
        })
    return ElementData(player_id=player_id, history=history, upcoming=upcoming)


# ---------------------------------------------------------------------------
# Position-specific scoring
# ---------------------------------------------------------------------------

POS_GOAL_PTS  = {1: 10, 2: 6, 3: 5, 4: 4}
POS_CS_PTS    = {1: 4,  2: 4, 3: 1, 4: 0}
POS_ASSIST_PTS = 3

# ---------------------------------------------------------------------------
# FDR-based fallback multipliers (kept as 40% component in v3)
# ---------------------------------------------------------------------------

FDR_ATT_MULT = {2: 1.25, 3: 1.00, 4: 0.80, 5: 0.65}
FDR_CS_PROB  = {2: 0.45, 3: 0.30, 4: 0.18, 5: 0.08}
FDR_GC_MULT  = {2: 0.75, 3: 1.00, 4: 1.35, 5: 1.70}

HOME_CS_BOOST    = 1.15
AWAY_CS_PENALTY  = 0.85
HOME_ATT_BOOST   = 1.08
AWAY_ATT_PENALTY = 0.94

_LEAGUE_AVG_GOALS = 1.3   # typical EPL goals scored per team per game


def _fdr_clamp(fdr: int) -> int:
    return max(2, min(5, fdr))


# ---------------------------------------------------------------------------
# v3 multiplier functions
# ---------------------------------------------------------------------------

def _att_multiplier(
    fdr: int,
    is_home: bool,
    attacker_team_id: int = 0,
    opponent_team_id: int = 0,
    team_strength: Optional[dict] = None,
) -> float:
    """
    Attack multiplier: 60% team-strength ratio + 40% FDR-based.
    Falls back to pure FDR when strength data is unavailable.
    """
    fdr_base = FDR_ATT_MULT[_fdr_clamp(fdr)]
    home_adv  = HOME_ATT_BOOST if is_home else AWAY_ATT_PENALTY
    fdr_component = fdr_base * home_adv

    if (team_strength and attacker_team_id in team_strength
            and opponent_team_id in team_strength and opponent_team_id != 0):
        att_key = "attack_home" if is_home else "attack_away"
        def_key = "defence_away" if is_home else "defence_home"
        att_str = team_strength[attacker_team_id].get(att_key, 1200)
        def_str = team_strength[opponent_team_id].get(def_key, 1200)
        # Ratio > 1 means attacker's team is stronger relative to opponent defence
        ratio = att_str / max(800, def_str)
        strength_component = max(0.5, min(1.8, ratio))
        return 0.4 * fdr_component + 0.6 * strength_component

    return fdr_component


def _cs_probability(
    fdr: int,
    is_home: bool,
    opponent_team_id: int = 0,
    hist_team_stats: Optional[dict] = None,
) -> float:
    """CS probability using opponent's historical attack rate (60%) + FDR base (40%)."""
    base      = FDR_CS_PROB[_fdr_clamp(fdr)]
    home_mult = HOME_CS_BOOST if is_home else AWAY_CS_PENALTY
    fdr_cs    = base * home_mult

    if hist_team_stats and opponent_team_id in hist_team_stats and opponent_team_id != 0:
        # When we defend at home, opponent attacks away and vice versa
        opp_key  = "away_scored_avg" if is_home else "home_scored_avg"
        opp_goals = hist_team_stats[opponent_team_id].get(opp_key, _LEAGUE_AVG_GOALS)
        # Lower opponent scoring rate → higher CS probability
        hist_cs = fdr_cs * (_LEAGUE_AVG_GOALS / max(0.3, opp_goals))
        hist_cs = max(0.03, min(0.60, hist_cs))
        return 0.4 * fdr_cs + 0.6 * hist_cs

    return fdr_cs


def _gc_expected(
    fdr: int,
    is_home: bool,
    opponent_team_id: int = 0,
    hist_team_stats: Optional[dict] = None,
) -> float:
    """Expected goals conceded: blend opponent historical scoring with FDR table."""
    fdr_gc = _LEAGUE_AVG_GOALS * FDR_GC_MULT[_fdr_clamp(fdr)]

    if hist_team_stats and opponent_team_id in hist_team_stats and opponent_team_id != 0:
        opp_key   = "away_scored_avg" if is_home else "home_scored_avg"
        hist_gc   = hist_team_stats[opponent_team_id].get(opp_key, _LEAGUE_AVG_GOALS)
        return 0.4 * fdr_gc + 0.6 * hist_gc

    return fdr_gc


# ---------------------------------------------------------------------------
# Per-player helper functions
# ---------------------------------------------------------------------------

def _minutes_probability(player: Player, el: Optional[ElementData] = None) -> float:
    if player.status in ("i", "s", "u"):
        return 0.0
    base = player.chance_next / 100.0 if player.chance_next else (0.5 if player.status == "d" else 1.0)
    if el is not None:
        base *= el.recent_start_rate
    elif player.starts < 5:
        base *= 0.6
    return max(0.0, min(1.0, base))


def _expected_minutes(player: Player, el: Optional[ElementData] = None) -> float:
    if el is not None:
        recent = el.recent_minutes_avg
        if recent is not None:
            season_avg = player.minutes / max(1, player.starts)
            return max(0.0, min(90.0, 0.7 * recent + 0.3 * season_avg))
    games = max(1, player.starts)
    avg   = player.minutes / games if games > 0 else 0
    return max(0.0, min(90.0, avg * 0.95 + 4.0))


def _effective_xgi_per90(
    player: Player,
    el: Optional[ElementData] = None,
    is_home: Optional[bool] = None,
) -> float:
    """
    Form-weighted xGI/90:
    - When home/away history is available: 40% H/A split + 30% recent-5 + 30% season.
    - Otherwise: 60% recent-5 + 40% season.
    """
    season_xgi = player.xgi_per_90
    if el is None:
        return season_xgi
    recent = el.recent_xgi_per90
    if is_home is not None:
        ha_xgi = el.home_xgi_per90 if is_home else el.away_xgi_per90
        if ha_xgi is not None and recent is not None:
            return 0.4 * ha_xgi + 0.3 * recent + 0.3 * season_xgi
        if ha_xgi is not None:
            return 0.5 * ha_xgi + 0.5 * season_xgi
    if recent is not None:
        return 0.6 * recent + 0.4 * season_xgi
    return season_xgi


def _penalty_bonus(player: Player) -> float:
    if player.starts < 5:
        return 0.0
    excess = player.goals_scored - player.xg_per_90 * (player.minutes / 90.0)
    if excess > 2.0:
        return 0.4
    if excess > 1.0:
        return 0.2
    return 0.0


def _appearance_pts(expected_mins: float) -> float:
    if expected_mins >= 60:
        return 2.0
    if expected_mins >= 1:
        return 1.0
    return 0.0


# ---------------------------------------------------------------------------
# Core per-fixture xP calculation
# ---------------------------------------------------------------------------

def _single_fixture_xp(
    player: Player,
    fixture: TeamFixture,
    el: Optional[ElementData] = None,
    team_strength: Optional[dict] = None,
    hist_team_stats: Optional[dict] = None,
) -> float:
    pos      = player.position
    exp_mins = _expected_minutes(player, el)
    mins_factor = exp_mins / 90.0

    app_pts = _appearance_pts(exp_mins)

    att_mult = _att_multiplier(
        fixture.fdr, fixture.is_home,
        player.team_id, fixture.opponent_id,
        team_strength,
    )
    xgi = _effective_xgi_per90(player, el, fixture.is_home) * mins_factor
    if xgi > 0 and (player.xg_per_90 + player.xa_per_90) > 0:
        goal_share = player.xg_per_90 / (player.xg_per_90 + player.xa_per_90)
    else:
        goal_share = 0.7 if pos == 4 else (0.5 if pos == 3 else 0.3)

    goals_pts   = xgi * goal_share * POS_GOAL_PTS[pos] * att_mult
    assists_pts = xgi * (1 - goal_share) * POS_ASSIST_PTS * att_mult

    cs_pts = POS_CS_PTS[pos] * _cs_probability(
        fixture.fdr, fixture.is_home,
        fixture.opponent_id, hist_team_stats,
    )

    if pos == 2:
        def_prob = min(1.0, player.def_contrib_per_90 / 10.0)
    elif pos in (3, 4):
        def_prob = min(1.0, player.def_contrib_per_90 / 12.0)
    else:
        def_prob = 0.0
    def_pts = 2.0 * def_prob * mins_factor

    saves_pts = 0.0
    if pos == 1 and player.minutes > 0:
        saves_per_90 = player.saves / (player.minutes / 90.0)
        saves_pts = (saves_per_90 / 3.0) * mins_factor

    gc_pts = 0.0
    if pos in (1, 2):
        exp_gc = _gc_expected(fixture.fdr, fixture.is_home, fixture.opponent_id, hist_team_stats)
        gc_pts = -(exp_gc / 2.0)

    games_played  = max(1, player.starts + 1)
    bonus_proxy   = min(1.2, (player.bps / games_played) / 40.0)
    penalty_pts   = _penalty_bonus(player)

    return max(0.0,
        app_pts + goals_pts + assists_pts + cs_pts
        + def_pts + saves_pts + gc_pts + bonus_proxy + penalty_pts
    )


def _player_xp_for_gw(
    player: Player,
    gw_fixtures: list[TeamFixture],
    el: Optional[ElementData] = None,
    team_strength: Optional[dict] = None,
    hist_team_stats: Optional[dict] = None,
) -> float:
    if not gw_fixtures:
        return 0.0
    mins_prob = _minutes_probability(player, el)
    if mins_prob <= 0:
        return 0.0
    total = sum(
        _single_fixture_xp(player, f, el, team_strength, hist_team_stats)
        for f in gw_fixtures
    )
    return total * mins_prob


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _element_fixtures_to_team_fixtures(el: ElementData, gw: int) -> list[TeamFixture]:
    """Convert element-summary upcoming fixtures for a GW into TeamFixture objects."""
    out = []
    for f in el.fixtures_for_gw(gw):
        if f.get("finished"):
            continue
        is_home = f["is_home"]
        team_h  = f.get("team_h")
        team_a  = f.get("team_a")
        # Derive opponent ID from home/away teams
        if is_home:
            opponent_id = team_a or 0
        else:
            opponent_id = team_h or 0
        out.append(TeamFixture(
            gw=gw,
            opponent_id=opponent_id,
            opponent_name="",
            is_home=is_home,
            fdr=max(2, min(5, f["difficulty"])),
            kickoff_time="",
        ))
    return out


def build_xp_matrix(
    players: list[Player],
    bootstrap: dict,
    start_gw: int,
    horizon: int = 5,
    element_data: Optional[dict] = None,
    team_strength: Optional[dict] = None,
    hist_team_stats: Optional[dict] = None,
) -> pd.DataFrame:
    """
    Returns DataFrame: index=player_id, columns=['gw_{n}' ...], values=derived xP.
    Populates player.xP, player.xP_horizon, player.xP_by_gw.

    New params:
      team_strength   — {team_id: {attack_home, attack_away, defence_home, defence_away}}
      hist_team_stats — {team_id: {home_scored_avg, away_scored_avg, home_conceded_avg, away_conceded_avg}}
    """
    schedule = build_team_schedule(bootstrap, start_gw, horizon)
    gw_cols  = [f"gw_{g}" for g in range(start_gw, start_gw + horizon)]
    rows: dict[int, dict] = {}

    for p in players:
        el           = element_data.get(p.id) if element_data else None
        team_fixtures = schedule.get(p.team_id, [])
        by_gw        = fixtures_by_gw(team_fixtures)

        row = {}
        p.xP_by_gw = {}
        for g in range(start_gw, start_gw + horizon):
            if el and el.upcoming:
                gw_fixtures = _element_fixtures_to_team_fixtures(el, g)
                if not gw_fixtures and g == start_gw:
                    gw_fixtures = by_gw.get(g, [])
            else:
                gw_fixtures = by_gw.get(g, [])

            xp = _player_xp_for_gw(p, gw_fixtures, el, team_strength, hist_team_stats)
            row[f"gw_{g}"] = round(xp, 3)
            p.xP_by_gw[g]  = round(xp, 3)

        p.xP         = row.get(f"gw_{start_gw}", 0.0)
        p.xP_horizon = round(sum(row.values()), 3)
        rows[p.id]   = row

    return pd.DataFrame.from_dict(rows, orient="index", columns=gw_cols)


def enrich_players_with_xp(
    players: list[Player],
    bootstrap: dict,
    start_gw: int,
    horizon_gws: int = 5,
    element_data: Optional[dict] = None,
    team_strength: Optional[dict] = None,
    hist_team_stats: Optional[dict] = None,
) -> tuple[list[Player], str]:
    """Main entry. Derives xP per GW from FPL stats + fixtures."""
    build_xp_matrix(
        players, bootstrap, start_gw, horizon_gws,
        element_data=element_data,
        team_strength=team_strength,
        hist_team_stats=hist_team_stats,
    )
    layers = []
    if element_data:
        layers.append("element-summary history")
    if team_strength:
        layers.append("team strength ratio")
    if hist_team_stats:
        layers.append("historical goal rates")
    source = f"Derived model v3 ({', '.join(layers) or 'FDR only'}), horizon={horizon_gws} GWs"
    return players, source


def compute_leo(players: list[Player], rival_picks: list[list[int]]) -> None:
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


def build_team_strength_map(bootstrap: dict) -> dict:
    """Extract per-team attack/defence strength from bootstrap. Returns {team_id: {...}}."""
    out = {}
    for t in bootstrap.get("teams", []):
        out[t["id"]] = {
            "attack_home":   t.get("strength_attack_home",   1200),
            "attack_away":   t.get("strength_attack_away",   1100),
            "defence_home":  t.get("strength_defence_home",  1200),
            "defence_away":  t.get("strength_defence_away",  1100),
        }
    return out


def build_hist_team_stats(all_fixtures: list[dict]) -> dict:
    """
    Compute per-team home/away scoring and conceding averages from finished fixtures.
    Returns {team_id: {home_scored_avg, away_scored_avg, home_conceded_avg, away_conceded_avg}}.
    """
    raw: dict[int, dict] = {}
    for fx in all_fixtures:
        if not fx.get("finished"):
            continue
        hs = fx.get("team_h_score")
        as_ = fx.get("team_a_score")
        if hs is None or as_ is None:
            continue
        h_id = fx.get("team_h")
        a_id = fx.get("team_a")
        for tid in (h_id, a_id):
            if tid and tid not in raw:
                raw[tid] = {"hs": [], "as_": [], "hc": [], "ac": []}
        if h_id:
            raw[h_id]["hs"].append(hs)
            raw[h_id]["hc"].append(as_)
        if a_id:
            raw[a_id]["as_"].append(as_)
            raw[a_id]["ac"].append(hs)

    out = {}
    for tid, d in raw.items():
        out[tid] = {
            "home_scored_avg":   sum(d["hs"]) / max(1, len(d["hs"])),
            "away_scored_avg":   sum(d["as_"]) / max(1, len(d["as_"])),
            "home_conceded_avg": sum(d["hc"]) / max(1, len(d["hc"])),
            "away_conceded_avg": sum(d["ac"]) / max(1, len(d["ac"])),
        }
    return out
