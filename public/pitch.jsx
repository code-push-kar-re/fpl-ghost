// Pitch view — renders 11 starters in formation + 4 bench
// Supports: click to select captain/vice, swap starter with bench, drag-reorder (basic click swap)

if (typeof document !== 'undefined' && !document.getElementById('fplghost-pitch-kf')) {
  const s = document.createElement('style');
  s.id = 'fplghost-pitch-kf';
  s.textContent = '@keyframes fplghostpulse { 0%,100% { box-shadow: 0 0 18px rgba(201,122,84,0.45); } 50% { box-shadow: 0 0 26px rgba(201,122,84,0.8); } }';
  document.head.appendChild(s);
}

function PitchView({ squad, setSquad, jerseyStyle, compact = false, interactive = true, title = 'GW1', showSubtitle = true, highlightCaptain = true }) {
  const [selected, setSelected] = React.useState(null);
  const [actionMenu, setActionMenu] = React.useState(null);
  const [swapMode, setSwapMode] = React.useState(null);
  const [infoPlayer, setInfoPlayer] = React.useState(null);

  const starters = squad.slice(0, 11);
  // Always render reserve GK (pos===1) first in bench row
  const bench = [...squad.slice(11, 15)].sort((a, b) =>
    a.pos === 1 ? -1 : b.pos === 1 ? 1 : 0
  );

  // FPL formation validity (1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD)
  const isValidFormation = (xi) => {
    const c = { 1: 0, 2: 0, 3: 0, 4: 0 };
    xi.forEach(p => { c[p.pos]++; });
    return c[1] === 1 && c[2] >= 3 && c[2] <= 5 && c[3] >= 2 && c[3] <= 5 && c[4] >= 1 && c[4] <= 3;
  };

  const computeEligible = (sourceId) => {
    const srcIdx = squad.findIndex(p => p.id === sourceId);
    if (srcIdx < 0) return new Set();
    const sourceIsBench = srcIdx >= 11;
    const candidates = sourceIsBench ? starters : bench;
    const eligible = new Set();
    candidates.forEach(cand => {
      // GKs can only swap with GKs
      if (squad[srcIdx].pos === 1 || cand.pos === 1) {
        if (squad[srcIdx].pos === cand.pos) eligible.add(cand.id);
        return;
      }
      // Trial swap and validate formation
      const next = [...squad];
      const ci = next.findIndex(p => p.id === cand.id);
      [next[srcIdx], next[ci]] = [next[ci], next[srcIdx]];
      const newXI = next.slice(0, 11);
      if (isValidFormation(newXI)) eligible.add(cand.id);
    });
    return eligible;
  };

  // ESC cancels swap mode
  React.useEffect(() => {
    if (!swapMode) return;
    const onKey = (e) => { if (e.key === 'Escape') setSwapMode(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [swapMode]);

  // Group starters by position for formation rows
  const gk = starters.filter(p => p.pos === 1);
  const def = starters.filter(p => p.pos === 2);
  const mid = starters.filter(p => p.pos === 3);
  const fwd = starters.filter(p => p.pos === 4);

  const setCaptain = (id) => {
    setSquad(prev => {
      const next = prev.map(p => ({ ...p, captain: false }));
      const target = next.find(p => p.id === id);
      if (target) target.captain = true;
      // Ensure captain != vice
      const wasVice = prev.find(p => p.id === id)?.vice;
      if (wasVice) {
        const oldCap = prev.find(p => p.captain);
        if (oldCap) {
          const n = next.find(p => p.id === oldCap.id);
          if (n) n.vice = true;
        }
        const t = next.find(p => p.id === id);
        if (t) t.vice = false;
      }
      return next;
    });
    setActionMenu(null);
  };

  const setVice = (id) => {
    setSquad(prev => {
      const next = prev.map(p => ({ ...p, vice: false }));
      const target = next.find(p => p.id === id);
      if (target) target.vice = true;
      return next;
    });
    setActionMenu(null);
  };

  const performSwap = (aId, bId) => {
    setSquad(prev => {
      const next = [...prev];
      const i = next.findIndex(p => p.id === aId);
      const j = next.findIndex(p => p.id === bId);
      if (i < 0 || j < 0) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSelected(null);
    setActionMenu(null);
    setSwapMode(null);
  };

  const startSwapMode = (sourceId) => {
    const eligibleIds = computeEligible(sourceId);
    if (eligibleIds.size === 0) {
      setActionMenu(null);
      setSwapMode(null);
      return;
    }
    setSwapMode({ sourceId, eligibleIds });
    setActionMenu(null);
  };

  const handleCardClick = (player, e) => {
    if (!interactive) return;
    // In swap mode: a click on an eligible target performs the swap; anything else cancels
    if (swapMode) {
      if (swapMode.eligibleIds.has(player.id)) {
        performSwap(swapMode.sourceId, player.id);
      } else {
        setSwapMode(null);
        setSelected(null);
      }
      return;
    }
    setSelected(player);
    setActionMenu({ playerId: player.id, x: e.clientX, y: e.clientY });
  };

  const Row = ({ players, yPct }) => (
    <div style={{
      position: 'absolute',
      top: `${yPct}%`,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: '0 6%',
    }}>
      {players.map(p => (
        <PlayerCard
          key={p.id}
          player={p}
          jerseyStyle={jerseyStyle}
          selected={selected?.id === p.id}
          highlight={swapMode?.eligibleIds.has(p.id)}
          dimmed={swapMode && !swapMode.eligibleIds.has(p.id) && swapMode.sourceId !== p.id}
          source={swapMode?.sourceId === p.id}
          onClick={(e) => handleCardClick(p, e)}
          onInfo={() => setInfoPlayer(p)}
          size={compact ? 44 : 56}
        />
      ))}
    </div>
  );

  // Formation row positions
  const rowY = {
    gk: 3,
    def: def.length >= 4 ? 23 : 25,
    mid: 45,
    fwd: 67,
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Header bar */}
      {showSubtitle && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '16px 20px 0',
        }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, color: '#7a6f7e', letterSpacing: 0.4, marginBottom: 4 }}>Free Transfers</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: '#2a2230' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 12h14m-4-4 4 4-4 4M21 12v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                {(window.FPL_STATE?.freeTransfers ?? 1)} FT · {(window.FPL_STATE?.transfersUsed ?? 0)} used
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#7a6f7e', letterSpacing: 0.4, marginBottom: 4 }}>ITB</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#2a2230' }}>£ 0.5</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Auto-captain button */}
            {interactive && (() => {
              const nextGw  = window.FPL_STATE?.nextGw;
              const optimal = window.FPL_STATE?.optimalByGw?.[nextGw];
              if (!optimal) return null;
              const autoCap = () => setCaptain(optimal.captainId);
              const currentCap = squad.find(p => p.captain);
              const alreadySet = currentCap?.id === optimal.captainId;
              return (
                <button
                  onClick={autoCap}
                  title={`Auto: ${optimal.captainName} (highest xP)`}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 16,
                    border: 'none',
                    background: alreadySet ? 'rgba(74,122,74,0.15)' : 'rgba(107,53,83,0.12)',
                    color: alreadySet ? '#4a7a4a' : '#6b3553',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: alreadySet ? 'default' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span>⚡</span>
                  <span>{alreadySet ? `${optimal.captainName} ✓` : `Auto: ${optimal.captainName}`}</span>
                </button>
              );
            })()}
            <div style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: 36,
              color: '#3a2d44',
              lineHeight: 1,
              letterSpacing: -0.5,
            }}>
              {title}
            </div>
          </div>
        </div>
      )}

      {/* Pitch */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1.1',
        marginTop: 8,
        background: `
          radial-gradient(ellipse at 50% 110%, rgba(124, 67, 98, 0.08) 0%, transparent 60%),
          linear-gradient(180deg, #FDFAF4 0%, #F7F1E8 100%)
        `,
        borderRadius: 14,
        overflow: 'visible',
      }}>
        {/* Subtle pitch lines */}
        <svg width="100%" height="100%" viewBox="0 0 100 110" style={{ position: 'absolute', inset: 0, opacity: 0.15 }}>
          <rect x="2" y="2" width="96" height="106" rx="1" fill="none" stroke="#6a5570" strokeWidth="0.2" />
          <line x1="2" y1="55" x2="98" y2="55" stroke="#6a5570" strokeWidth="0.2" />
          <circle cx="50" cy="55" r="8" fill="none" stroke="#6a5570" strokeWidth="0.2" />
          <rect x="30" y="2" width="40" height="14" fill="none" stroke="#6a5570" strokeWidth="0.2" />
          <rect x="30" y="94" width="40" height="14" fill="none" stroke="#6a5570" strokeWidth="0.2" />
        </svg>

        <Row players={gk} yPct={rowY.gk} />
        <Row players={def} yPct={rowY.def} />
        <Row players={mid} yPct={rowY.mid} />
        <Row players={fwd} yPct={rowY.fwd} />

        {/* Bench strip */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '20%',
          background: 'linear-gradient(180deg, rgba(203, 213, 225, 0.25) 0%, rgba(203, 213, 225, 0.55) 100%)',
          borderRadius: '0 0 14px 14px',
          borderTop: '1px dashed rgba(60, 45, 68, 0.2)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '0 6%',
        }}>
          {bench.map(p => (
            <PlayerCard
              key={p.id}
              player={p}
              jerseyStyle={jerseyStyle}
              selected={selected?.id === p.id}
              highlight={swapMode?.eligibleIds.has(p.id)}
              dimmed={swapMode && !swapMode.eligibleIds.has(p.id) && swapMode.sourceId !== p.id}
              source={swapMode?.sourceId === p.id}
              onClick={(e) => handleCardClick(p, e)}
              onInfo={() => setInfoPlayer(p)}
              size={compact ? 40 : 48}
              dim
            />
          ))}
        </div>
      </div>

      {/* Swap hint bar */}
      {swapMode && interactive && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(107, 53, 83, 0.95)',
          color: '#FDFAF4',
          padding: '8px 14px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: 0.3,
          zIndex: 50,
          boxShadow: '0 6px 18px rgba(60,30,50,0.25)',
          fontFamily: 'Inter, sans-serif',
          whiteSpace: 'nowrap',
        }}>
          Tap a highlighted player to swap · ESC to cancel
        </div>
      )}

      {/* Player info drawer */}
      {infoPlayer && (
        <window.PlayerInfoDrawer player={infoPlayer} onClose={() => setInfoPlayer(null)} />
      )}

      {/* Action menu */}
      {actionMenu && interactive && (
        <ActionMenu
          playerId={actionMenu.playerId}
          x={actionMenu.x}
          y={actionMenu.y}
          squad={squad}
          onCaptain={() => setCaptain(actionMenu.playerId)}
          onVice={() => setVice(actionMenu.playerId)}
          onPromote={() => startSwapMode(actionMenu.playerId)}
          onClose={() => { setActionMenu(null); setSelected(null); }}
        />
      )}
    </div>
  );
}

function PlayerCard({ player, jerseyStyle, selected, onClick, onInfo, size = 56, dim = false, highlight = false, dimmed = false, source = false }) {
  const priceLabel = `${player.price.toFixed(1)}M`;
  const opacity = dimmed ? 0.35 : (dim ? 0.92 : 1);
  const transform = source
    ? 'translateY(-4px) scale(1.06)'
    : (highlight ? 'translateY(-2px) scale(1.02)' : (selected ? 'translateY(-4px) scale(1.04)' : 'none'));
  const filter = highlight
    ? 'drop-shadow(0 0 0 3px #c97a54) drop-shadow(0 6px 14px rgba(201, 122, 84, 0.45))'
    : (source
        ? 'drop-shadow(0 6px 16px rgba(108, 60, 96, 0.5))'
        : (selected ? 'drop-shadow(0 6px 14px rgba(108, 60, 96, 0.35))' : 'none'));
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, opacity 0.15s ease',
        transform,
        opacity,
        filter,
      }}
    >
      {highlight && (
        <div style={{
          position: 'absolute',
          top: -4, left: -4, right: -4, bottom: -4,
          borderRadius: 14,
          border: '2.5px solid #c97a54',
          boxShadow: '0 0 18px rgba(201, 122, 84, 0.55)',
          animation: 'fplghostpulse 1.4s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 1,
        }} />
      )}
      <div style={{ position: 'relative' }}>
        <window.Jersey
          club={player.club}
          style={jerseyStyle}
          size={size}
          captain={player.captain}
          vice={player.vice}
        />
        <window.StatusBadge player={player} size={16} />
      </div>

      {/* Name pill */}
      <div style={{
        marginTop: 6,
        background: selected ? '#7a3d5f' : '#6b3553',
        color: '#fff',
        fontSize: size * 0.18,
        fontWeight: 600,
        letterSpacing: 0.3,
        padding: `${size * 0.06}px ${size * 0.14}px`,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        boxShadow: '0 2px 4px rgba(60, 30, 50, 0.25)',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: size * 0.14, opacity: 0.8 }}>▸</span>
        {player.last}
      </div>

      {/* Info button */}
      {onInfo && (
        <button
          onClick={e => { e.stopPropagation(); onInfo(); }}
          style={{
            position: 'absolute',
            top: -6, right: -8,
            width: 18, height: 18,
            borderRadius: '50%',
            background: 'rgba(107,53,83,0.85)',
            border: '1.5px solid #FDFAF4',
            color: '#FDFAF4',
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 5,
            lineHeight: 1,
            padding: 0,
            boxShadow: '0 2px 6px rgba(60,30,50,0.3)',
          }}
          title="Player info"
        >i</button>
      )}

      {/* Price | xP row */}
      <div style={{
        marginTop: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        fontSize: size * 0.165,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ color: '#4a3a52', fontWeight: 500 }}>£{player.price.toFixed(1)}</span>
        <span style={{ color: 'rgba(74,58,82,0.3)', margin: '0 4px', fontWeight: 300 }}>|</span>
        <span style={{ color: '#6b3553', fontWeight: 600 }}>{(player.proj ?? 0).toFixed(1)}</span>
        <span style={{ color: '#9b8aa1', fontWeight: 400, marginLeft: 2, fontSize: size * 0.13 }}>pts</span>
      </div>

      {/* Fixture info */}
      <div style={{
        marginTop: 2,
        fontSize: size * 0.14,
        color: '#8a7a90',
        fontWeight: 500,
        letterSpacing: 0.2,
      }}>
        {window.FIXTURES[player.club]?.[0]
          ? `${window.FIXTURES[player.club][0].opp}(${window.FIXTURES[player.club][0].h ? 'H' : 'A'})`
          : ''}
      </div>
    </div>
  );
}

function ActionMenu({ playerId, x, y, squad, onCaptain, onVice, onPromote, onClose }) {
  const ref = React.useRef();
  React.useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const player = squad.find(p => p.id === playerId);
  if (!player) return null;

  // Position menu sensibly
  const menuX = Math.min(x, window.innerWidth - 200);
  const menuY = Math.min(y, window.innerHeight - 240);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: menuY,
        left: menuX,
        background: '#FDFAF4',
        border: '1px solid rgba(60, 45, 68, 0.15)',
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(60, 30, 50, 0.18), 0 2px 8px rgba(60, 30, 50, 0.08)',
        padding: 8,
        minWidth: 200,
        zIndex: 100,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid rgba(60, 45, 68, 0.08)' }}>
        <div style={{ fontSize: 11, color: '#8a7a90', letterSpacing: 0.4, marginBottom: 2 }}>
          {player.pos === 1 ? 'GOALKEEPER' : player.pos === 2 ? 'DEFENDER' : player.pos === 3 ? 'MIDFIELDER' : 'FORWARD'}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#2a2230' }}>{player.name}</div>
        <div style={{ fontSize: 12, color: '#6b5a72', marginTop: 2 }}>
          {window.TEAMS[player.club]?.name} · £{player.price.toFixed(1)}m · {player.proj.toFixed(1)} pts proj
        </div>
      </div>
      <MenuItem onClick={onCaptain} icon="C" label={player.captain ? 'Remove captaincy' : 'Make captain'} />
      <MenuItem onClick={onVice} icon="V" label={player.vice ? 'Remove vice' : 'Make vice-captain'} />
      <MenuItem onClick={onPromote} icon="↕" label={player.startIdx < 11 ? 'Swap with bench…' : 'Promote to starting XI…'} hint="Tap another player" />
    </div>
  );
}

function MenuItem({ onClick, icon, label, hint, muted }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px',
        borderRadius: 6,
        cursor: onClick ? 'pointer' : 'default',
        background: hover && onClick ? 'rgba(123, 60, 96, 0.08)' : 'transparent',
        opacity: muted ? 0.7 : 1,
      }}
    >
      <div style={{
        width: 22, height: 22,
        borderRadius: '50%',
        background: 'rgba(123, 60, 96, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        color: '#6b3553',
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: '#2a2230', fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: '#9b8aa1' }}>{hint}</div>}
      </div>
    </div>
  );
}

// ── Player Info Drawer ──────────────────────────────────────────────────────
function PlayerInfoDrawer({ player, onClose }) {
  if (!player) return null;

  // Lock body scroll while open
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const pos = player.pos === 1 ? 'GK' : player.pos === 2 ? 'DEF' : player.pos === 3 ? 'MID' : 'FWD';
  const yellows = player.yellowCards ?? player.yellow_cards ?? 0;
  // FPL: 5 yellows in first 19 GWs OR 10 yellows total = 1-match ban
  const suspRisk = yellows >= 4;
  const suspended = yellows >= 5 || player.status === 's';
  const xpArr = player.xpByGw || [];
  const maxXp = Math.max(...xpArr.map(g => g.xp), 1);

  // Portal to document.body ensures position:fixed is always relative to
  // the actual viewport, not a transformed/filtered ancestor container.
  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(42, 26, 48, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FDFAF4',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(60,30,50,0.25)',
          width: 340,
          maxWidth: '92vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #6b3553 0%, #3a2d44 100%)',
          padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <window.Jersey club={player.club} style="default" size={44} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#FDFAF4', letterSpacing: -0.3 }}>{player.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(253,250,244,0.65)', marginTop: 2 }}>
              {window.TEAMS?.[player.club]?.name || player.club} · {pos} · £{player.price?.toFixed(1)}m
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FDFAF4', borderRadius: 20, width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        </div>

        <div style={{ padding: '16px 20px 20px' }}>

          {/* Status / alerts */}
          {(suspended || suspRisk || player.status !== 'a' || player.news) && (
            <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {suspended && (
                <AlertBadge color="#b85a4e" icon="🔴" text={`SUSPENDED · ${yellows} yellow cards`} />
              )}
              {!suspended && suspRisk && (
                <AlertBadge color="#c97a54" icon="🟡" text={`Yellow card risk · ${yellows}/5 — next = 1-match ban`} />
              )}
              {player.status === 'i' && (
                <AlertBadge color="#b85a4e" icon="🏥" text={`Injured · ${player.news || 'No return date'}`} />
              )}
              {player.status === 'd' && (
                <AlertBadge color="#c97a54" icon="⚠️" text={`Doubt · ${player.chance ?? player.chance_next ?? '?'}% chance · ${player.news || ''}`} />
              )}
              {player.news && player.status === 'a' && (
                <AlertBadge color="#7a6f7e" icon="ℹ️" text={player.news} />
              )}
            </div>
          )}

          {/* 5-GW xP chart */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: '#7a6f7e', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 10 }}>
              Expected points — next 5 GWs
            </div>
            {xpArr.length > 0 ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 72 }}>
                {xpArr.map(({ gw, xp }) => {
                  const h = Math.max(4, (xp / maxXp) * 60);
                  const isBlank = xp === 0;
                  return (
                    <div key={gw} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 10, color: isBlank ? '#c8bfcc' : '#6b3553', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {isBlank ? '—' : xp.toFixed(1)}
                      </div>
                      <div style={{
                        width: '100%', height: h,
                        background: isBlank
                          ? 'rgba(107,53,83,0.08)'
                          : `rgba(107,53,83,${0.25 + (xp / maxXp) * 0.65})`,
                        borderRadius: 4,
                        transition: 'height 0.3s ease',
                      }} />
                      <div style={{ fontSize: 10, color: '#9b8aa1', letterSpacing: 0.2 }}>GW{gw}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: '#9b8aa1', fontSize: 12, fontStyle: 'italic' }}>No projection data</div>
            )}
          </div>

          {/* Stats row */}
          <div style={{
            marginTop: 14,
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
          }}>
            {[
              { label: 'Form', val: player.form?.toFixed(1) ?? '—' },
              { label: 'Selected', val: player.selected ? `${player.selected}%` : '—' },
              { label: 'xGI/90', val: player.xGI?.toFixed(2) ?? '—' },
            ].map(({ label, val }) => (
              <div key={label} style={{ background: 'rgba(107,53,83,0.05)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#7a6f7e', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, color: '#3a2d44' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function AlertBadge({ color, icon, text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      background: `${color}12`,
      border: `1px solid ${color}30`,
      borderRadius: 8, padding: '8px 10px',
      fontSize: 12, color: '#3a2d44',
    }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

Object.assign(window, { PitchView, PlayerCard, PlayerInfoDrawer });
