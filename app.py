"""FPL Ghost — Streamlit entry point."""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

import config
import fpl_api
import xp_engine
import solver
import team_xp
import ai_advisor
import pitch_view
from models import Player, Squad, RivalEntry, Transfer

# ---------------------------------------------------------------------------
# Page config & global CSS
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="FPL Ghost",
    page_icon="👻",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(f"""
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">

<style>
  html, body, [data-testid="stAppViewContainer"], [data-testid="stMain"] {{
      background-color: {config.BG_COLOR} !important;
      color: {config.TEXT_PRIMARY} !important;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }}
  [data-testid="stSidebar"] {{
      background-color: {config.CARD_BG} !important;
      border-right: 1px solid {config.BORDER_COLOR};
  }}
  [data-testid="stSidebar"] * {{ color: {config.TEXT_PRIMARY}; }}

  /* Headings use Instrument Serif — editorial display type */
  h1, h2, h3, h4 {{
      font-family: 'Instrument Serif', Georgia, serif !important;
      color: {config.DEEP_INK} !important;
      font-weight: 400 !important;
      letter-spacing: -0.5px;
  }}
  h1 {{ font-size: 42px !important; letter-spacing: -0.8px; }}
  h2 {{ font-size: 32px !important; }}
  h3 {{ font-size: 22px !important; }}

  /* Metric cards — warm cream, plum numerals */
  [data-testid="stMetric"] {{
      background-color: {config.CARD_BG};
      border: 1px solid {config.BORDER_COLOR};
      border-radius: 14px;
      padding: 16px 18px;
  }}
  [data-testid="stMetricValue"] {{
      color: {config.DEEP_INK} !important;
      font-family: 'Instrument Serif', Georgia, serif !important;
      font-weight: 400 !important;
      font-size: 34px !important;
      letter-spacing: -1px;
  }}
  [data-testid="stMetricLabel"] {{
      color: {config.TEXT_MUTED} !important;
      font-size: 11px !important;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      font-weight: 500 !important;
  }}

  div[data-testid="stDataFrame"], div[data-testid="stTable"] {{
      background-color: {config.CARD_BG};
      border-radius: 12px;
      border: 1px solid {config.BORDER_COLOR};
      overflow: hidden;
  }}

  .stTabs [data-baseweb="tab"] {{
      color: {config.TEXT_MUTED};
      font-weight: 500;
  }}
  .stTabs [aria-selected="true"] {{
      color: {config.PLUM} !important;
      border-bottom-color: {config.PLUM} !important;
  }}

  /* Primary buttons — plum solid */
  .stButton>button {{
      background-color: {config.PLUM};
      color: #FDFAF4;
      border: none;
      border-radius: 10px;
      font-weight: 500;
      padding: 8px 16px;
      transition: all 0.15s ease;
  }}
  .stButton>button:hover {{
      background-color: {config.DEEP_INK};
      color: {config.PEACH_HI};
      transform: translateY(-1px);
  }}

  .stTextInput>div>input, .stTextArea textarea, .stSelectbox>div>div {{
      background-color: {config.CARD_BG} !important;
      color: {config.TEXT_PRIMARY} !important;
      border: 1px solid {config.BORDER_COLOR} !important;
      border-radius: 10px !important;
  }}

  /* Sidebar radio — no bullets, rounded pills */
  [data-testid="stSidebar"] [role="radiogroup"] label {{
      padding: 8px 12px;
      border-radius: 8px;
      margin-bottom: 2px;
  }}

  .gain-badge {{
      color: {config.POSITIVE};
      font-weight: 600;
  }}
  .risk-badge {{
      color: {config.NEGATIVE};
      font-weight: 600;
  }}

  /* Subtitle under title */
  .subtitle {{
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      color: {config.TEXT_MUTED};
      letter-spacing: 0.3px;
  }}

  /* Hero pill for top-of-page stat */
  .hero-pill {{
      background: linear-gradient(135deg, {config.PEACH_HI} 0%, {config.PEACH_LO} 100%);
      border-radius: 16px;
      padding: 20px 24px;
      color: {config.TEXT_PRIMARY};
  }}

  ::-webkit-scrollbar {{ width: 10px; height: 10px; }}
  ::-webkit-scrollbar-track {{ background: transparent; }}
  ::-webkit-scrollbar-thumb {{ background: rgba(60,45,68,0.15); border-radius: 5px; }}
  ::-webkit-scrollbar-thumb:hover {{ background: rgba(60,45,68,0.30); }}
</style>
""", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Session state helpers
# ---------------------------------------------------------------------------

def _init_state() -> None:
    defaults = {
        "bootstrap": None,
        "players": [],
        "xp_source": "",
        "my_squad": None,
        "league_id": None,
        "rival_entries": [],
        "current_gw": 1,
        "transfers": [],
        "chat_history": [],
        "manager_id": None,
        "horizon_gws": 3,
        "n_free_transfers": 1,
        "rival_boost": 0.5,
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v


def _load_bootstrap() -> None:
    with st.spinner("Loading FPL data..."):
        bootstrap = fpl_api.get_bootstrap()
        players = fpl_api.build_players(bootstrap)
        gw = fpl_api.get_current_gw(bootstrap)
        players, xp_source = xp_engine.enrich_players_with_xp(
            players,
            bootstrap=bootstrap,
            start_gw=gw,
            horizon_gws=st.session_state.horizon_gws,
        )
        st.session_state.bootstrap = bootstrap
        st.session_state.players = players
        st.session_state.current_gw = gw
        st.session_state.xp_source = xp_source


def _player_map() -> dict[int, Player]:
    return {p.id: p for p in st.session_state.players}


# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------

def render_sidebar() -> str:
    # Editorial header — monogram + wordmark per design
    st.sidebar.markdown(f"""
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
          <div style="width:36px;height:36px;border-radius:10px;
               background:linear-gradient(135deg,{config.DEEP_INK} 0%,{config.PLUM} 100%);
               display:flex;align-items:center;justify-content:center;
               color:{config.PEACH_HI};font-family:'Instrument Serif',serif;font-size:22px;line-height:1;">g</div>
          <div>
            <div style="font-family:'Instrument Serif',serif;font-size:22px;
                 color:{config.TEXT_PRIMARY};line-height:1.05;letter-spacing:-0.3px;">FPL Ghost</div>
            <div style="font-size:10px;color:{config.TEXT_MUTED};letter-spacing:0.4px;
                 margin-top:3px;font-weight:500;text-transform:uppercase;">Benchmark · GW33</div>
          </div>
        </div>
    """, unsafe_allow_html=True)
    st.sidebar.divider()

    # Manager ID input
    manager_id_str = st.sidebar.text_input(
        "Your FPL Manager ID", value=str(st.session_state.manager_id or ""),
        placeholder="e.g. 1234567", key="manager_id_input"
    )
    if manager_id_str.strip().isdigit():
        st.session_state.manager_id = int(manager_id_str.strip())

    league_id_str = st.sidebar.text_input(
        "Mini-League ID", value=str(st.session_state.league_id or ""),
        placeholder="e.g. 314159", key="league_id_input"
    )
    if league_id_str.strip().isdigit():
        st.session_state.league_id = int(league_id_str.strip())

    st.sidebar.divider()
    st.session_state.horizon_gws = st.sidebar.slider(
        "xP Horizon (GWs)", 1, config.MAX_HORIZON_GWS, st.session_state.horizon_gws
    )
    st.session_state.n_free_transfers = st.sidebar.number_input(
        "Free Transfers", 1, 5, st.session_state.n_free_transfers
    )
    st.session_state.rival_boost = st.sidebar.slider(
        "Differential Boost", 0.0, 2.0, st.session_state.rival_boost, step=0.1,
        help="Extra weight given to low-LEO (differential) players in the optimizer."
    )

    st.sidebar.divider()
    col1, col2 = st.sidebar.columns(2)
    with col1:
        if st.button("Load Data", use_container_width=True):
            _load_bootstrap()
            st.rerun()
    with col2:
        if st.button("Refresh", use_container_width=True):
            fpl_api.clear_cache()
            _load_bootstrap()
            st.rerun()

    if st.session_state.xp_source:
        st.sidebar.caption(f"xP source: {st.session_state.xp_source}")

    page = st.sidebar.radio(
        "Navigate",
        ["Compare", "Lineup", "Transfers", "League", "Planner", "Advisor"],
        label_visibility="collapsed",
    )
    return page


# ---------------------------------------------------------------------------
# Tab: Compare — head-to-head vs rival (design's default view)
# ---------------------------------------------------------------------------

def render_compare() -> None:
    st.markdown(f"""
      <div style='margin-bottom:20px'>
        <h1 style='margin:0'>Compare</h1>
        <div class='subtitle'>Head-to-head — project your squad against a rival over the horizon.</div>
      </div>
    """, unsafe_allow_html=True)

    if not st.session_state.players:
        st.info("Click **Load Data** in the sidebar to begin.")
        return

    # Rival ID input
    rival_col1, rival_col2 = st.columns([3, 1])
    with rival_col1:
        rival_id_str = st.text_input(
            "Rival FPL Manager ID", value="646223",
            placeholder="e.g. 646223",
        )
    with rival_col2:
        st.write("")
        st.write("")
        run = st.button("Benchmark", use_container_width=True)

    if not (rival_id_str.strip().isdigit() and run):
        st.caption("Enter a rival manager ID and click Benchmark.")
        return

    rival_id = int(rival_id_str.strip())
    pmap = _player_map()
    gw = st.session_state.current_gw
    horizon = st.session_state.horizon_gws

    with st.spinner("Fetching rival squad..."):
        try:
            rival_info = fpl_api._get(f"entry/{rival_id}/")
            rival_picks = fpl_api.get_entry_picks(rival_id, gw)
        except Exception as e:
            st.error(f"Could not load rival: {e}")
            return

    rival_squad = fpl_api.build_squad_from_picks(rival_picks, pmap)
    for i, p in enumerate(rival_squad.players):
        mapped = pmap.get(p.id)
        if mapped:
            rival_squad.players[i] = mapped

    my_squad = st.session_state.my_squad
    if not my_squad and st.session_state.manager_id:
        my_picks = fpl_api.get_entry_picks(st.session_state.manager_id, gw)
        my_squad = fpl_api.build_squad_from_picks(my_picks, pmap)
        for i, p in enumerate(my_squad.players):
            mapped = pmap.get(p.id)
            if mapped:
                my_squad.players[i] = mapped
        st.session_state.my_squad = my_squad

    if not my_squad:
        st.warning("Load your own squad in the Lineup tab first, or enter your manager ID in the sidebar.")
        return

    my_plan = team_xp.plan_horizon(my_squad, gw, horizon)
    rival_plan = team_xp.plan_horizon(rival_squad, gw, horizon)

    delta = my_plan.total_xp - rival_plan.total_xp
    win = _win_probability(my_plan.total_xp, rival_plan.total_xp)

    my_name = f"Manager {st.session_state.manager_id or '—'}"
    rival_name = f"{rival_info.get('player_first_name','')} {rival_info.get('player_last_name','')}"
    rival_team = rival_info.get("name", "Rival")

    # Hero pill — peach gradient with big Instrument Serif number
    sign = "+" if delta >= 0 else ""
    delta_color = config.POSITIVE if delta >= 0 else config.NEGATIVE
    st.markdown(f"""
      <div class='hero-pill' style='margin-bottom:20px'>
        <div style='font-size:11px;letter-spacing:0.5px;text-transform:uppercase;
             color:#7a5548;font-weight:500'>
          Win probability vs {rival_name.strip() or rival_team} · GW{gw}–{gw+horizon-1}
        </div>
        <div style='display:flex;align-items:baseline;gap:20px;margin-top:8px'>
          <div style="font-family:'Instrument Serif',serif;font-size:72px;line-height:0.95;
               color:{config.TEXT_PRIMARY};letter-spacing:-2.5px;">
            {win:.0f}%
          </div>
          <div style='font-family:Inter,sans-serif;color:#7a5548'>
            <div style='font-size:13px;font-weight:500'>
              <span style='color:{delta_color};font-weight:700'>{sign}{delta:.1f} pts</span> projected swing
            </div>
            <div style='font-size:12px;margin-top:4px'>
              You: <b>{my_plan.total_xp:.1f}</b> &nbsp;·&nbsp;
              {rival_team}: <b>{rival_plan.total_xp:.1f}</b>
            </div>
          </div>
        </div>
      </div>
    """, unsafe_allow_html=True)

    # Side-by-side summary cards
    col_me, col_rival = st.columns(2)

    def _card(col, title, subtitle, plan, is_mine: bool):
        col.markdown(f"""
          <div style='background:{config.CARD_BG};border:1px solid {config.BORDER_COLOR};
               border-radius:14px;padding:14px 18px;margin-bottom:12px'>
            <div style='display:flex;align-items:center;gap:10px'>
              <div style='width:28px;height:28px;border-radius:50%;
                   background:{config.PLUM if is_mine else config.CORAL};color:#fff;
                   display:flex;align-items:center;justify-content:center;
                   font-size:11px;font-weight:700'>{"TM" if is_mine else "RV"}</div>
              <div>
                <div style='font-size:14px;font-weight:600'>{title}</div>
                <div style='font-size:11px;color:{config.TEXT_MUTED};margin-top:2px'>
                  {subtitle}
                </div>
              </div>
              <div style='flex:1'></div>
              <div style="font-family:'Instrument Serif',serif;font-size:28px;
                   color:{config.DEEP_INK};letter-spacing:-0.8px">
                {plan.total_xp:.1f}
              </div>
            </div>
          </div>
        """, unsafe_allow_html=True)

    _card(col_me, "Your squad",
          f"{len(my_plan.gws)} GWs · avg {my_plan.total_xp / max(1,len(my_plan.gws)):.1f} pts/GW",
          my_plan, is_mine=True)
    _card(col_rival, rival_team,
          f"{rival_name.strip()} · rank {rival_info.get('summary_overall_rank','—')}",
          rival_plan, is_mine=False)

    # Differential analysis: who has whom
    st.markdown("### Player differentials")
    my_ids = {p.id for p in my_squad.players[:11]}
    rv_ids = {p.id for p in rival_squad.players[:11]}
    my_only = [pmap[i] for i in (my_ids - rv_ids) if i in pmap]
    rv_only = [pmap[i] for i in (rv_ids - my_ids) if i in pmap]
    shared = [pmap[i] for i in (my_ids & rv_ids) if i in pmap]

    c1, c2, c3 = st.columns(3)
    c1.metric("Shared XI", f"{len(shared)}")
    c2.metric("Your differentials", f"{len(my_only)}")
    c3.metric("Rival differentials", f"{len(rv_only)}")

    col_l, col_r = st.columns(2)
    with col_l:
        st.markdown("**You have, rival doesn't**")
        rows = [{
            "Player": p.web_name, "Pos": p.position_name,
            "xP (horizon)": f"{p.xP_horizon:.2f}",
        } for p in sorted(my_only, key=lambda x: -x.xP_horizon)]
        if rows:
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    with col_r:
        st.markdown("**Rival has, you don't**")
        rows = [{
            "Player": p.web_name, "Pos": p.position_name,
            "xP (horizon)": f"{p.xP_horizon:.2f}",
        } for p in sorted(rv_only, key=lambda x: -x.xP_horizon)]
        if rows:
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)


def _win_probability(my_xp: float, rival_xp: float,
                     my_std: float = 15.2, rival_std: float = 16.8) -> float:
    """
    Probability that my_xp beats rival_xp under Gaussian diff.
    Matches the design's calculateWinProb formula.
    """
    import math
    diff_mean = my_xp - rival_xp
    diff_std = (my_std ** 2 + rival_std ** 2) ** 0.5
    if diff_std == 0:
        return 50.0
    z = diff_mean / diff_std
    # Normal CDF approximation
    return 100.0 * 0.5 * (1.0 + math.erf(z / math.sqrt(2)))


# ---------------------------------------------------------------------------
# Tab: Squad Builder
# ---------------------------------------------------------------------------

def render_squad_builder() -> None:
    st.header("Squad Builder")

    if not st.session_state.players:
        st.info("Click **Load Data** in the sidebar to begin.")
        return

    col_a, col_b, col_c = st.columns([2, 1, 1])

    with col_a:
        st.markdown("### Optimised Squad")
        if st.button("Run LP Optimizer", key="run_lp"):
            with st.spinner("Solving..."):
                squad = solver.build_squad(
                    st.session_state.players,
                    horizon_gws=st.session_state.horizon_gws,
                    rival_boost=st.session_state.rival_boost,
                )
                st.session_state.my_squad = squad
            st.rerun()

        if st.session_state.manager_id and st.button("Load My Actual Team", key="load_team"):
            with st.spinner("Fetching your picks..."):
                picks = fpl_api.get_entry_picks(
                    st.session_state.manager_id, st.session_state.current_gw
                )
                squad = fpl_api.build_squad_from_picks(picks, _player_map())
                # Enrich with xP
                for p in squad.players:
                    mapped = _player_map().get(p.id)
                    if mapped:
                        p.xP = mapped.xP
                        p.xP_horizon = mapped.xP_horizon
                        p.leo = mapped.leo
                st.session_state.my_squad = squad
            st.rerun()

    with col_b:
        gw = st.session_state.current_gw
        st.metric("Current GW", gw)
    with col_c:
        if st.session_state.my_squad:
            st.metric("Squad Cost", f"£{st.session_state.my_squad.total_cost_m:.1f}m")

    if st.session_state.my_squad:
        squad: Squad = st.session_state.my_squad
        xi, bench = solver.optimize_xi(squad)

        fig = pitch_view.render_pitch(xi)
        st.plotly_chart(fig, use_container_width=True)

        st.markdown("#### Starting XI")
        _render_player_table(xi)

        st.markdown("#### Bench")
        _render_player_table(bench)


def _render_player_table(players: list[Player]) -> None:
    rows = []
    for p in players:
        leo_str = f"{p.leo:.0%}" if p.leo > 0 else "—"
        rows.append({
            "Player": p.web_name,
            "Pos": p.position_name,
            "Team": p.team_name,
            "Cost": f"£{p.cost_m:.1f}m",
            "xP": f"{p.xP:.2f}",
            "xP (horizon)": f"{p.xP_horizon:.2f}",
            "LEO": leo_str,
            "News": p.news[:40] if p.news else "—",
        })
    df = pd.DataFrame(rows)
    st.dataframe(df, use_container_width=True, hide_index=True)


# ---------------------------------------------------------------------------
# Tab: Rotation Planner
# ---------------------------------------------------------------------------

def render_rotation_planner() -> None:
    st.header("Rotation Planner")
    st.caption(
        "Per-GW optimal XI with captain selection across your xP horizon. "
        "xP is derived from FPL's xGI/90, xGC/90, minutes, and Fixture Difficulty."
    )

    if not st.session_state.players:
        st.info("Load data first.")
        return
    if not st.session_state.my_squad:
        st.info("Build or load your squad first (Squad Builder tab).")
        return

    squad: Squad = st.session_state.my_squad
    start_gw = st.session_state.current_gw
    horizon = st.session_state.horizon_gws

    with st.spinner("Solving per-GW XI..."):
        plan = team_xp.plan_horizon(squad, start_gw, horizon)

    col_a, col_b, col_c = st.columns(3)
    col_a.metric("Horizon", f"GW{start_gw}–{start_gw + horizon - 1}")
    col_b.metric("Total Team xP", f"{plan.total_xp:.2f}")
    avg = plan.total_xp / max(1, len(plan.gws))
    col_c.metric("Avg GW xP", f"{avg:.2f}")

    # Summary table
    st.markdown("### GW-by-GW Plan")
    st.dataframe(pd.DataFrame(plan.to_table()), use_container_width=True, hide_index=True)

    # xP matrix for squad across horizon
    st.markdown("### Squad xP Matrix")
    st.caption("Your 15 players × upcoming GWs. Green = starter that GW, (C) = captain.")

    rows = []
    for p in squad.players:
        row = {
            "Player": p.web_name,
            "Pos": p.position_name,
            "Team": p.team_name,
        }
        for gw in range(start_gw, start_gw + horizon):
            xp = p.xP_by_gw.get(gw, 0.0)
            is_starter = any(
                gp.gw == gw and p.id in {x.id for x in gp.starting_xi}
                for gp in plan.gws
            )
            is_captain = any(
                gp.gw == gw and gp.captain.id == p.id for gp in plan.gws
            )
            tag = " (C)" if is_captain else (" ★" if is_starter else "")
            row[f"GW{gw}"] = f"{xp:.2f}{tag}"
        row["Total"] = f"{p.xP_horizon:.2f}"
        rows.append(row)

    rows.sort(key=lambda r: float(r["Total"]), reverse=True)
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    # Per-GW detail
    st.markdown("### GW Detail")
    gw_tabs = st.tabs([f"GW{gp.gw}" for gp in plan.gws])
    for tab, gp in zip(gw_tabs, plan.gws):
        with tab:
            cols = st.columns(3)
            cols[0].metric("Formation", gp.formation)
            cols[1].metric("Captain", gp.captain.web_name, f"+{gp.captain_bonus:.2f}")
            cols[2].metric("GW xP", f"{gp.total_xp:.2f}")

            st.markdown("**Starting XI**")
            xi_rows = [
                {
                    "Player": p.web_name,
                    "Pos": p.position_name,
                    "Team": p.team_name,
                    "xP": f"{p.xP_by_gw.get(gp.gw, 0):.2f}",
                    "Role": "(C)" if p.id == gp.captain.id else ("(VC)" if p.id == gp.vice_captain.id else ""),
                }
                for p in gp.starting_xi
            ]
            st.dataframe(pd.DataFrame(xi_rows), use_container_width=True, hide_index=True)

            st.markdown("**Bench**")
            bench_rows = [
                {
                    "Player": p.web_name,
                    "Pos": p.position_name,
                    "Team": p.team_name,
                    "xP": f"{p.xP_by_gw.get(gp.gw, 0):.2f}",
                }
                for p in gp.bench
            ]
            st.dataframe(pd.DataFrame(bench_rows), use_container_width=True, hide_index=True)


# ---------------------------------------------------------------------------
# Tab: Transfer Lab
# ---------------------------------------------------------------------------

def render_transfer_lab() -> None:
    st.header("Transfer Lab")

    if not st.session_state.players:
        st.info("Load data first.")
        return

    if not st.session_state.my_squad:
        st.info("Build or load your squad in Squad Builder first.")
        return

    n_transfers = st.selectbox("Number of transfers to evaluate", [1, 2, 3], index=0)

    if st.button("Find Best Transfers", key="find_transfers"):
        with st.spinner("Analysing transfer options..."):
            transfers = solver.recommend_transfers(
                st.session_state.my_squad,
                st.session_state.players,
                n_free_transfers=st.session_state.n_free_transfers,
                n_transfers=int(n_transfers),
                rival_boost=st.session_state.rival_boost,
            )
            st.session_state.transfers = transfers
        st.rerun()

    if st.session_state.transfers:
        st.markdown("### Transfer Recommendations")
        for i, t in enumerate(st.session_state.transfers, 1):
            hit = max(0, i - st.session_state.n_free_transfers) * config.TRANSFER_HIT
            net = t.xp_gain - hit
            color = config.NEON_GREEN if net >= 0 else config.SOFT_RED
            badge = f"<span style='color:{color}; font-size:1.2em; font-weight:bold'>Net xP: {net:+.2f}</span>"

            with st.container():
                cols = st.columns([3, 1, 3, 2])
                cols[0].markdown(
                    f"**OUT:** {t.player_out.web_name}  \n"
                    f"xP {t.player_out.xP:.2f} | LEO {t.player_out.leo:.0%} | £{t.player_out.cost_m:.1f}m"
                )
                cols[1].markdown("→")
                cols[2].markdown(
                    f"**IN:** {t.player_in.web_name}  \n"
                    f"xP {t.player_in.xP:.2f} | LEO {t.player_in.leo:.0%} | £{t.player_in.cost_m:.1f}m"
                )
                cols[3].markdown(badge, unsafe_allow_html=True)
                if hit > 0:
                    st.caption(f"Transfer #{i} incurs a {hit}-point hit.")
                st.divider()


# ---------------------------------------------------------------------------
# Tab: League Spy
# ---------------------------------------------------------------------------

def render_league_spy() -> None:
    st.header("League Spy")

    if not st.session_state.players:
        st.info("Load data first.")
        return

    if not st.session_state.league_id:
        st.info("Enter a Mini-League ID in the sidebar.")
        return

    if st.button("Spy on Rivals", key="spy"):
        with st.spinner("Fetching rival squads..."):
            rivals = fpl_api.build_rival_entries(st.session_state.league_id)
            rivals = fpl_api.enrich_rivals_with_picks(rivals, st.session_state.current_gw)
            rival_picks = [r.picks for r in rivals]
            xp_engine.compute_leo(st.session_state.players, rival_picks)
            st.session_state.rival_entries = rivals
        st.rerun()

    rivals: list[RivalEntry] = st.session_state.rival_entries
    if not rivals:
        return

    # Standings table
    st.markdown("### Mini-League Standings")
    standings_data = [
        {
            "Rank": r.rank,
            "Manager": r.player_name,
            "Team": r.team_name,
            "GW Pts": r.gw_points,
            "Total": r.total_points,
        }
        for r in rivals
    ]
    st.dataframe(pd.DataFrame(standings_data), use_container_width=True, hide_index=True)

    # LEO table — sorted by LEO desc
    st.markdown("### League Effective Ownership (LEO)")
    players_with_leo = [p for p in st.session_state.players if p.leo > 0]
    players_with_leo.sort(key=lambda p: p.leo, reverse=True)
    top_owned = players_with_leo[:20]

    leo_data = [
        {
            "Player": p.web_name,
            "Pos": p.position_name,
            "LEO": f"{p.leo:.0%}",
            "xP": f"{p.xP:.2f}",
            "Differential?": "YES" if p.leo < 0.3 and p.xP > 4 else "—",
            "Cost": f"£{p.cost_m:.1f}m",
        }
        for p in top_owned
    ]
    st.dataframe(pd.DataFrame(leo_data), use_container_width=True, hide_index=True)

    # Differentials
    st.markdown("### Differential Targets (Low LEO, High xP)")
    differentials = [
        p for p in st.session_state.players
        if p.leo < 0.3 and p.xP >= 4.0
    ]
    differentials.sort(key=lambda p: p.xP - p.leo * 3, reverse=True)
    diff_data = [
        {
            "Player": p.web_name,
            "Pos": p.position_name,
            "Team": p.team_name,
            "LEO": f"{p.leo:.0%}",
            "xP": f"{p.xP:.2f}",
            "xP Swing": f"+{p.xP:.2f}",
            "Cost": f"£{p.cost_m:.1f}m",
        }
        for p in differentials[:15]
    ]
    if diff_data:
        st.dataframe(pd.DataFrame(diff_data), use_container_width=True, hide_index=True)
    else:
        st.info("No strong differentials found. Lower the LEO or xP threshold.")

    # Climb Meter
    if st.session_state.my_squad:
        _render_climb_meter(rivals)


def _render_climb_meter(rivals: list[RivalEntry]) -> None:
    st.markdown("### Climb Meter")
    st.caption("Estimated xP advantage your optimised squad has over each rival.")

    my_squad: Squad = st.session_state.my_squad
    my_total_xp = sum(p.xP for p in my_squad.players[:11])

    bars = []
    for rival in rivals[:5]:
        rival_xp = sum(
            _player_map().get(pid, Player(0, "", "", "", 0, "", 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, "")).xP
            for pid in rival.picks[:11]
        )
        delta = my_total_xp - rival_xp
        bars.append((rival.team_name, delta))

    fig = go.Figure()
    for name, delta in bars:
        color = config.NEON_GREEN if delta >= 0 else config.SOFT_RED
        fig.add_trace(go.Bar(
            x=[delta],
            y=[name],
            orientation="h",
            marker_color=color,
            showlegend=False,
            hovertemplate=f"{name}: {delta:+.2f} xP vs your squad<extra></extra>",
        ))

    fig.update_layout(
        paper_bgcolor=config.CARD_BG,
        plot_bgcolor=config.BG_COLOR,
        font=dict(color=config.TEXT_PRIMARY, family="Inter, sans-serif"),
        xaxis=dict(title="xP Advantage (+) / Deficit (-)", zeroline=True,
                   zerolinecolor=config.TEXT_MUTED),
        yaxis=dict(title=""),
        height=250,
        margin=dict(l=10, r=10, t=10, b=30),
    )
    st.plotly_chart(fig, use_container_width=True)


# ---------------------------------------------------------------------------
# Tab: AI Advisor
# ---------------------------------------------------------------------------

def render_ai_advisor() -> None:
    st.header("AI Advisor")

    if not config.ANTHROPIC_API_KEY:
        st.warning(
            "No `ANTHROPIC_API_KEY` found. Add it to your `.env` file to enable the AI Advisor."
        )
        return

    st.caption(
        "Ask anything about your squad, transfers, or rivals. "
        "The advisor has context of your current squad and mini-league."
    )

    # Display chat history
    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    user_input = st.chat_input("Ask FPL Ghost (e.g. 'Which differential gives me the best chance of overtaking 2nd place?')")

    if user_input:
        st.session_state.chat_history.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)

        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                response_chunks = []
                for chunk in ai_advisor.stream_advice(
                    user_question=user_input,
                    squad=st.session_state.my_squad,
                    transfers=st.session_state.transfers,
                    rivals=st.session_state.rival_entries,
                    gw=st.session_state.current_gw,
                    chat_history=st.session_state.chat_history[:-1],  # exclude current user msg
                ):
                    response_chunks.append(chunk)

                full_response = "".join(response_chunks)
                st.markdown(full_response)

        st.session_state.chat_history.append({"role": "assistant", "content": full_response})

    if st.session_state.chat_history:
        if st.button("Clear Chat", key="clear_chat"):
            st.session_state.chat_history = []
            st.rerun()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    _init_state()

    if st.session_state.bootstrap is None and not st.session_state.players:
        try:
            _load_bootstrap()
        except Exception:
            pass  # User will click Load Data manually

    page = render_sidebar()

    if page == "Compare":
        render_compare()
    elif page == "Lineup":
        render_squad_builder()
    elif page == "Planner":
        render_rotation_planner()
    elif page == "Transfers":
        render_transfer_lab()
    elif page == "League":
        render_league_spy()
    elif page == "Advisor":
        render_ai_advisor()


if __name__ == "__main__":
    main()
