import os
from dotenv import load_dotenv

load_dotenv()

FPL_BASE_URL = "https://fantasy.premierleague.com/api/"
CACHE_TTL_SECONDS = 600

# Theme tokens — "FPL Ghost" soft editorial palette (from Claude Design handoff)
BG_COLOR = "#F2ECE3"           # warm off-white canvas
CARD_BG = "#FDFAF4"            # card / panel surface
PLUM = "#6b3553"               # primary accent
DEEP_INK = "#3a2d44"           # headings
TEXT_PRIMARY = "#2a1a30"
TEXT_MUTED = "#8a7a90"
BORDER_COLOR = "rgba(60, 45, 68, 0.08)"
BORDER_STRONG = "rgba(60, 45, 68, 0.15)"

# Sentiment colors
POSITIVE = "#5c7a4f"           # sage green (gains)
NEGATIVE = "#b54b3a"           # warm terracotta (risks)
CORAL = "#c97a54"              # coral highlight
PEACH_HI = "#F3D9C3"           # peach gradient start
PEACH_LO = "#EAC3A7"           # peach gradient end
CREAM = "#F5E9C8"              # captain/VC badge

# Legacy names used elsewhere, remapped to the design palette
NEON_GREEN = POSITIVE
SOFT_RED = NEGATIVE
PITCH_GREEN = "#E8DFD0"        # pitch surface — muted sand (design style)

# Squad rules — FPL stores prices as int tenths (100 = £10.0m)
SQUAD_SIZE = 15
BUDGET_DEFAULT = 1000
MAX_PER_TEAM = 3
POSITION_COUNTS = {1: 2, 2: 5, 3: 5, 4: 3}   # GK, DEF, MID, FWD
POSITION_NAMES = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}
POSITION_COLORS = {
    1: "#d9b877",   # GK muted mustard
    2: "#7b9aa6",   # DEF dusty teal
    3: "#a46b8b",   # MID dusty plum
    4: "#c97a54",   # FWD coral
}

# Formation rules: (min_def, min_mid, min_fwd) for valid 11-man XIs
VALID_FORMATIONS = [
    (3, 4, 3), (3, 5, 2), (4, 3, 3), (4, 4, 2),
    (4, 5, 1), (5, 2, 3), (5, 3, 2), (5, 4, 1),
]

# xP ICT fallback linear model: xP ≈ slope * ict_index + intercept
XP_ICT_SLOPE = 0.077
XP_ICT_INTERCEPT = 0.12
XP_DECAY = 0.85     # per-GW decay for horizon projection

# LP solver
TRANSFER_HIT = 4    # points deducted per extra transfer beyond free transfers
MAX_HORIZON_GWS = 5

# Anthropic
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = "claude-sonnet-4-6"

# External xP source (CSV download URL — swap to any public provider)
XP_EXTERNAL_URL = os.getenv(
    "XP_EXTERNAL_URL",
    "https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data/2024-25/gws/merged_gw.csv",
)
