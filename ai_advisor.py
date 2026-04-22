"""Claude-backed FPL strategy advisor."""

import json
from typing import Iterator

import anthropic

import config
from models import Squad, Transfer, RivalEntry

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    return _client


SYSTEM_PROMPT = """You are FPL Ghost — an elite Fantasy Premier League strategist AI.
You receive structured data about the user's squad, their mini-league rivals, and LP-optimised transfer recommendations.
Your job is to explain the math in plain English and give decisive, opinionated tactical advice.

Key principles:
- Prioritise DIFFERENTIAL VALUE: favour high-xP players with low rival ownership.
- Be concise and tactical. No hedging — make a call.
- Reference specific player names and point differentials.
- When the user gives natural-language constraints (e.g., "no Arsenal players"), honour them explicitly.
- Quantify every claim: "Son gives you a +4.2 xP swing vs the leader" beats "Son is a good differential."
"""


def _build_context(
    squad: Squad | None,
    transfers: list[Transfer],
    rivals: list[RivalEntry],
    gw: int,
) -> str:
    parts = [f"**Gameweek:** {gw}"]

    if squad:
        squad_lines = [
            f"  - {p.web_name} ({p.position_name}, £{p.cost_m:.1f}m, xP={p.xP:.2f}, LEO={p.leo:.0%})"
            for p in squad.players
        ]
        parts.append("**Your Squad:**\n" + "\n".join(squad_lines))

    if transfers:
        t_lines = []
        for t in transfers:
            direction = "gain" if t.xp_gain >= 0 else "loss"
            t_lines.append(
                f"  - OUT {t.player_out.web_name} → IN {t.player_in.web_name} "
                f"| xP {direction}: {abs(t.xp_gain):.2f} | Cost delta: £{t.cost_delta_m:.1f}m"
            )
        parts.append("**LP-Recommended Transfers:**\n" + "\n".join(t_lines))

    if rivals:
        r_lines = [
            f"  - {r.rank}. {r.team_name} ({r.player_name}) — {r.total_points} pts"
            for r in rivals[:5]
        ]
        parts.append("**Top Mini-League Rivals:**\n" + "\n".join(r_lines))

    return "\n\n".join(parts)


def get_advice(
    user_question: str,
    squad: Squad | None = None,
    transfers: list[Transfer] | None = None,
    rivals: list[RivalEntry] | None = None,
    gw: int = 1,
) -> str:
    """Non-streaming advice call. Returns full response string."""
    context = _build_context(squad, transfers or [], rivals or [], gw)
    message = _get_client().messages.create(
        model=config.ANTHROPIC_MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": f"{context}\n\n---\n\n{user_question}"}
        ],
    )
    return message.content[0].text


def stream_advice(
    user_question: str,
    squad: Squad | None = None,
    transfers: list[Transfer] | None = None,
    rivals: list[RivalEntry] | None = None,
    gw: int = 1,
    chat_history: list[dict] | None = None,
) -> Iterator[str]:
    """Streaming advice — yields text chunks. Use with st.write_stream()."""
    context = _build_context(squad, transfers or [], rivals or [], gw)

    messages = list(chat_history or [])
    if not messages:
        messages.append(
            {"role": "user", "content": f"{context}\n\n---\n\n{user_question}"}
        )
    else:
        messages.append({"role": "user", "content": user_question})

    with _get_client().messages.stream(
        model=config.ANTHROPIC_MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            yield text
