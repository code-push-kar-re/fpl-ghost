"""Plotly pitch visualization component."""

import plotly.graph_objects as go

import config
from models import Player

# (x, y) slot positions per formation slot count in each row
# Rows from bottom (GK) to top (FWD). y values: 0.08, 0.28, 0.55, 0.78, 0.93
_GK_SLOTS = [(0.5, 0.05)]

_FORMATION_SLOTS: dict[str, list[tuple[float, float]]] = {
    "4-4-2": [
        (0.2, 0.22), (0.4, 0.22), (0.6, 0.22), (0.8, 0.22),   # DEF
        (0.2, 0.50), (0.4, 0.50), (0.6, 0.50), (0.8, 0.50),   # MID
        (0.3, 0.78), (0.7, 0.78),                               # FWD
    ],
    "4-3-3": [
        (0.2, 0.22), (0.4, 0.22), (0.6, 0.22), (0.8, 0.22),
        (0.25, 0.52), (0.5, 0.52), (0.75, 0.52),
        (0.2, 0.80), (0.5, 0.80), (0.8, 0.80),
    ],
    "3-5-2": [
        (0.25, 0.22), (0.5, 0.22), (0.75, 0.22),
        (0.1, 0.50), (0.3, 0.50), (0.5, 0.50), (0.7, 0.50), (0.9, 0.50),
        (0.35, 0.80), (0.65, 0.80),
    ],
    "5-3-2": [
        (0.1, 0.22), (0.3, 0.22), (0.5, 0.22), (0.7, 0.22), (0.9, 0.22),
        (0.25, 0.52), (0.5, 0.52), (0.75, 0.52),
        (0.35, 0.80), (0.65, 0.80),
    ],
    "5-4-1": [
        (0.1, 0.22), (0.3, 0.22), (0.5, 0.22), (0.7, 0.22), (0.9, 0.22),
        (0.2, 0.50), (0.4, 0.50), (0.6, 0.50), (0.8, 0.50),
        (0.5, 0.80),
    ],
    "4-5-1": [
        (0.2, 0.22), (0.4, 0.22), (0.6, 0.22), (0.8, 0.22),
        (0.1, 0.50), (0.3, 0.50), (0.5, 0.50), (0.7, 0.50), (0.9, 0.50),
        (0.5, 0.80),
    ],
    "3-4-3": [
        (0.25, 0.22), (0.5, 0.22), (0.75, 0.22),
        (0.2, 0.50), (0.4, 0.50), (0.6, 0.50), (0.8, 0.50),
        (0.2, 0.80), (0.5, 0.80), (0.8, 0.80),
    ],
}

_DEFAULT_SLOTS = _FORMATION_SLOTS["4-4-2"]


def _detect_formation(xi: list[Player]) -> str:
    defs = sum(1 for p in xi if p.position == 2)
    mids = sum(1 for p in xi if p.position == 3)
    fwds = sum(1 for p in xi if p.position == 4)
    label = f"{defs}-{mids}-{fwds}"
    return label if label in _FORMATION_SLOTS else "4-4-2"


def _pitch_shape() -> list[dict]:
    """Muted sand pitch with thin plum markings — matches editorial design."""
    line = "rgba(107, 53, 83, 0.22)"
    shapes = [
        dict(type="rect", x0=0.05, y0=0, x1=0.95, y1=0.95,
             line=dict(color=line, width=1.5), fillcolor=config.PITCH_GREEN),
        dict(type="circle", x0=0.38, y0=0.42, x1=0.62, y1=0.58,
             line=dict(color=line, width=1)),
        dict(type="line", x0=0.05, y0=0.50, x1=0.95, y1=0.50,
             line=dict(color=line, width=1)),
        dict(type="rect", x0=0.22, y0=0, x1=0.78, y1=0.14,
             line=dict(color=line, width=1), fillcolor="rgba(0,0,0,0)"),
        dict(type="rect", x0=0.22, y0=0.81, x1=0.78, y1=0.95,
             line=dict(color=line, width=1), fillcolor="rgba(0,0,0,0)"),
    ]
    return shapes


def render_pitch(
    starting_xi: list[Player],
    formation: str | None = None,
    user_squad_ids: set[int] | None = None,
) -> go.Figure:
    """
    Returns a Plotly figure of the 11-man pitch.
    Players are colored by position. LEO shown as opacity (lower = more differential).
    """
    gks = [p for p in starting_xi if p.position == 1]
    outfield = [p for p in starting_xi if p.position != 1]

    detected = formation or _detect_formation(starting_xi)
    slots = _FORMATION_SLOTS.get(detected, _DEFAULT_SLOTS)

    all_players = gks + outfield
    all_positions = _GK_SLOTS + slots[:len(outfield)]

    xs, ys, texts, hover_texts, colors, sizes = [], [], [], [], [], []

    for i, player in enumerate(all_players):
        if i >= len(all_positions):
            break
        px, py = all_positions[i]
        xs.append(px)
        ys.append(py)

        pos_color = config.POSITION_COLORS.get(player.position, "#ffffff")
        colors.append(pos_color)
        sizes.append(42)

        name_label = player.web_name
        if len(name_label) > 10:
            name_label = name_label[:10]
        texts.append(name_label)

        leo_pct = f"{player.leo:.0%}" if player.leo > 0 else "—"
        is_user = "★ " if user_squad_ids and player.id in user_squad_ids else ""
        hover_texts.append(
            f"{is_user}{player.web_name}<br>"
            f"xP: {player.xP:.2f}<br>"
            f"LEO: {leo_pct}<br>"
            f"Cost: £{player.cost_m:.1f}m<br>"
            f"News: {player.news or 'Available'}"
        )

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=xs, y=ys,
        mode="markers+text",
        marker=dict(
            size=sizes,
            color=colors,
            line=dict(width=2, color=config.CARD_BG),
            symbol="circle",
        ),
        text=texts,
        textposition="middle center",
        textfont=dict(size=9, color=config.CARD_BG, family="Inter, sans-serif"),
        hovertext=hover_texts,
        hoverinfo="text",
    ))

    fig.update_layout(
        paper_bgcolor=config.CARD_BG,
        plot_bgcolor=config.PITCH_GREEN,
        margin=dict(l=0, r=0, t=30, b=0),
        height=480,
        xaxis=dict(visible=False, range=[0, 1]),
        yaxis=dict(visible=False, range=[-0.05, 1.0]),
        shapes=_pitch_shape(),
        title=dict(
            text=f"Formation · {detected}",
            font=dict(color=config.DEEP_INK, size=14, family="Instrument Serif, serif"),
            x=0.5,
        ),
        showlegend=False,
    )
    return fig
