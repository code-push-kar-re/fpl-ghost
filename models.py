from dataclasses import dataclass, field


@dataclass
class Player:
    id: int
    web_name: str
    first_name: str
    second_name: str
    team_id: int
    team_name: str
    position: int           # 1=GK 2=DEF 3=MID 4=FWD
    cost: int               # tenths of millions
    selected_by_percent: float
    ict_index: float
    form: float
    total_points: int
    minutes: int
    goals_scored: int
    assists: int
    clean_sheets: int
    yellow_cards: int = 0
    news: str = ""
    # Underlying stats for xP derivation
    status: str = "a"
    chance_next: int = 100
    starts: int = 0
    xg_per_90: float = 0.0
    xa_per_90: float = 0.0
    xgi_per_90: float = 0.0
    xgc_per_90: float = 0.0
    def_contrib_per_90: float = 0.0
    saves: int = 0
    bps: int = 0
    bonus: int = 0
    points_per_game: float = 0.0
    ep_next: float = 0.0
    # Derived
    xP: float = 0.0         # next-GW xP (most recent derivation)
    xP_horizon: float = 0.0 # sum over N future GWs
    xP_by_gw: dict = field(default_factory=dict)   # {gw: xP}
    leo: float = 0.0        # League Effective Ownership

    @property
    def cost_m(self) -> float:
        return self.cost / 10.0

    @property
    def position_name(self) -> str:
        from config import POSITION_NAMES
        return POSITION_NAMES.get(self.position, "???")


@dataclass
class Squad:
    players: list[Player]
    total_cost: int

    @property
    def total_cost_m(self) -> float:
        return self.total_cost / 10.0

    @property
    def budget_remaining(self) -> int:
        from config import BUDGET_DEFAULT
        return BUDGET_DEFAULT - self.total_cost

    def get_by_position(self, pos: int) -> list[Player]:
        return [p for p in self.players if p.position == pos]

    def player_ids(self) -> list[int]:
        return [p.id for p in self.players]


@dataclass
class Transfer:
    player_out: Player
    player_in: Player
    xp_gain: float
    cost_delta: int         # positive = money freed up

    @property
    def cost_delta_m(self) -> float:
        return self.cost_delta / 10.0


@dataclass
class RivalEntry:
    entry_id: int
    player_name: str
    team_name: str
    rank: int
    gw_points: int
    total_points: int
    picks: list[int] = field(default_factory=list)   # player IDs

    def owns(self, player_id: int) -> bool:
        return player_id in self.picks


@dataclass
class LeagueOwnership:
    player_id: int
    web_name: str
    leo: float              # 0.0–1.0
    xP: float
    is_differential: bool   # LEO < 0.3 and xP > median
