// Suggested transfers — always-visible pre-computed cards with hover-to-preview stats bar.

function CompareSimulator({ mySquad, setMySquad, rivalSquad, jerseyStyle }) {
  const [horizonMode, setHorizonMode] = React.useState('five'); // 'next' | 'five' — default to 5-GW view
  const [hoveredIdx, setHoveredIdx]   = React.useState(null);

  const POOL      = window.PLAYER_POOL || [];
  const rivalName = (window.RIVAL_INFO?.manager || window.MINI_LEAGUE?.find(e => e.id === 'rival')?.manager || '')
    .split(' ')[0] || 'Your rival';

  const baseProj    = window.calculateProjection(mySquad);
  const rivalProj   = window.calculateProjection(rivalSquad);
  const baseWinProb = window.calculateWinProb(baseProj, rivalProj, 15.2, 16.8);

  const recs = React.useMemo(
    () => computeTopTransfers(mySquad, rivalSquad, POOL, rivalName, horizonMode === 'five'),
    [mySquad, rivalSquad, horizonMode]
  );

  // Preview squad when a card is hovered
  const hRec = hoveredIdx !== null ? recs[hoveredIdx] : null;
  const previewSquad = React.useMemo(() => {
    if (!hRec) return null;
    return mySquad.map(p => p.id === hRec.out.id ? {
      ...hRec.in,
      id: `sim_${hRec.in.id}`,
      captain: p.captain, vice: p.vice, startIdx: p.startIdx,
      last: hRec.in.name.toUpperCase(),
    } : p);
  }, [mySquad, hRec]);

  const previewProj = previewSquad ? window.calculateProjection(previewSquad) : null;
  const previewWp   = previewSquad ? window.calculateWinProb(previewProj, rivalProj, 15.2, 16.8) : null;
  const projDelta   = previewProj !== null ? previewProj - baseProj : null;

  const applyTransfer = (rec) => {
    setMySquad(prev => prev.map(p => p.id === rec.out.id ? {
      ...rec.in,
      // Keep the pool player's real id so duplicate-detection still works
      last: (rec.in.name || rec.in.last || 'PLAYER').toUpperCase().slice(0, 10),
      captain: p.captain, vice: p.vice, startIdx: p.startIdx,
      status: rec.in.status || 'a',
    } : p));
    setHoveredIdx(null);
  };

  return (
    <div style={{
      background: '#FDFAF4',
      border: '1px solid rgba(60,45,68,0.08)',
      borderRadius: 14,
      marginTop: 16,
      overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid rgba(60,45,68,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg, #F3D9C3, #EAC3A7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#8a5548', fontSize: 15,
          }}>✦</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2a2230' }}>Suggested transfers</div>
            <div style={{ fontSize: 11, color: '#8a7a90', marginTop: 2 }}>
              Best swaps to close the gap on rival. Hover a card to preview win-prob change.
            </div>
          </div>
        </div>

        {/* Next GW / Next 5 GWs toggle */}
        <div style={{
          display: 'flex', background: 'rgba(60,45,68,0.05)',
          borderRadius: 9, padding: 3, gap: 2, flexShrink: 0,
        }}>
          {[
            { key: 'next', top: 'Next GW',    bot: 'max points' },
            { key: 'five', top: 'Next 5 GWs', bot: 'max cumulative' },
          ].map(({ key, top, bot }) => (
            <button
              key={key}
              onClick={() => setHorizonMode(key)}
              style={{
                padding: '6px 14px',
                background: horizonMode === key ? '#FDFAF4' : 'transparent',
                border: 'none', borderRadius: 7, cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'right',
                boxShadow: horizonMode === key ? '0 1px 3px rgba(60,30,50,0.08)' : 'none',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: horizonMode === key ? 600 : 400, color: horizonMode === key ? '#2a2230' : '#8a7a90' }}>{top}</div>
              <div style={{ fontSize: 10, color: '#9b8aa1', marginTop: 1 }}>{bot}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
        gap: 1, background: 'rgba(60,45,68,0.07)',
        borderBottom: '1px solid rgba(60,45,68,0.07)',
      }}>
        {[
          {
            label: 'CURRENT PROJ',
            val: `${baseProj.toFixed(1)} pts`,
            serif: true,
          },
          {
            label: 'AFTER TRANSFER',
            val: previewProj !== null ? `${previewProj.toFixed(1)} pts` : '—',
            serif: previewProj !== null,
            muted: previewProj === null,
          },
          {
            label: 'WIN PROB',
            val: previewWp !== null
              ? `${(previewWp * 100).toFixed(0)}%`
              : `${(baseWinProb * 100).toFixed(0)}%`,
            serif: true,
          },
          {
            label: 'Δ VS NOW',
            val: projDelta !== null
              ? `${projDelta >= 0 ? '+' : ''}${projDelta.toFixed(1)} pts`
              : 'hover card →',
            serif: projDelta !== null,
            muted: projDelta === null,
            color: projDelta !== null ? (projDelta >= 0 ? '#4a7a4a' : '#b85a4e') : undefined,
          },
        ].map(({ label, val, serif, muted, color }) => (
          <div key={label} style={{ background: '#FDFAF4', padding: '11px 16px' }}>
            <div style={{
              fontSize: 10, color: '#8a7a90', letterSpacing: 0.5,
              textTransform: 'uppercase', fontWeight: 600, marginBottom: 4,
            }}>{label}</div>
            <div style={{
              fontFamily: serif ? "'Instrument Serif', serif" : 'Inter, sans-serif',
              fontSize: serif ? 20 : 12,
              color: color || (muted ? '#9b8aa1' : '#2a1a30'),
              fontStyle: muted ? 'italic' : 'normal',
              lineHeight: 1.2,
            }}>{val}</div>
          </div>
        ))}
      </div>

      {/* ── Transfer cards ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, padding: 16 }}>
        {recs.slice(0, 3).map((rec, i) => (
          <TransferCard
            key={i}
            rec={rec}
            rank={i + 1}
            jerseyStyle={jerseyStyle}
            hovered={hoveredIdx === i}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            onApply={() => applyTransfer(rec)}
          />
        ))}
        {recs.length === 0 && (
          <div style={{
            gridColumn: '1/-1', padding: '24px 16px',
            textAlign: 'center', color: '#9b8aa1', fontSize: 13, fontStyle: 'italic',
          }}>
            No transfer suggestions found for this gameweek.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Individual transfer suggestion card ────────────────────────────────────
function TransferCard({ rec, rank, jerseyStyle, hovered, onMouseEnter, onMouseLeave, onApply }) {
  const reasonLabel = rec.isBlank ? 'DODGE BLANK' : rec.rivalHas ? 'CATCH RIVAL' : 'UPGRADE';

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        background: hovered ? 'rgba(243,217,195,0.22)' : '#FDFAF4',
        border: `1px solid ${hovered ? 'rgba(201,122,84,0.32)' : 'rgba(60,45,68,0.1)'}`,
        borderRadius: 12, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {/* Row 1: rank bubble · reason tag · pts delta */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: '#2a1a30', color: '#F3D9C3',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Instrument Serif', serif", fontSize: 12, flexShrink: 0,
        }}>{rank}</div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', paddingTop: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#8a6656', letterSpacing: 0.4 }}>
            {reasonLabel}
          </span>
          {rec.rivalHas && (
            <span style={{
              fontSize: 9, fontWeight: 700,
              background: 'rgba(201,122,84,0.18)', color: '#b85a4e',
              padding: '2px 6px', borderRadius: 4, letterSpacing: 0.3,
            }}>RIVAL HAS</span>
          )}
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 20, color: '#4a7a4a', lineHeight: 1,
          }}>+{rec.delta.toFixed(1)} pts</div>
          <div style={{ fontSize: 9, color: '#8a7a90', letterSpacing: 0.2, marginTop: 2 }}>next GW</div>
        </div>
      </div>

      {/* Row 2: OUT jersey → IN jersey */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        background: 'rgba(60,45,68,0.035)', borderRadius: 8,
      }}>
        {/* OUT */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <window.Jersey club={rec.out.club} style="minimal" size={26} />
          <div>
            <div style={{ fontSize: 10, color: '#8a7a90', textDecoration: 'line-through', lineHeight: 1.3 }}>
              {rec.out.name}
            </div>
            <div style={{ fontSize: 10, color: '#9b8aa1' }}>£{rec.out.price.toFixed(1)}m</div>
          </div>
        </div>

        <span style={{ color: '#8a6656', fontSize: 16, flexShrink: 0 }}>→</span>

        {/* IN */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <window.Jersey club={rec.in.club} style={jerseyStyle} size={30} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#2a2230', lineHeight: 1.3 }}>
              {rec.in.name}
            </div>
            <div style={{ fontSize: 10, color: '#8a7a90' }}>
              £{rec.in.price.toFixed(1)}m · {rec.in.proj.toFixed(1)} pts
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: plain-English description */}
      <div style={{ fontSize: 11, color: '#6b5a72', lineHeight: 1.55, flexGrow: 1 }}>
        {rec.description}
      </div>

      {/* Row 4: apply button */}
      <button
        onClick={onApply}
        style={{
          width: '100%', padding: '9px 12px',
          background: 'transparent',
          border: '1px solid rgba(60,45,68,0.2)',
          borderRadius: 8, fontSize: 12, fontWeight: 600,
          color: '#2a2230', cursor: 'pointer', fontFamily: 'inherit',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(60,45,68,0.05)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >Apply transfer</button>
    </div>
  );
}

// ── Transfer scoring algorithm ─────────────────────────────────────────────
// Scores every valid (out, in) pair and returns top results ranked by:
//   1. Blank-gameweek dodges  2. Catch-rival differentials  3. Pure xP upgrade
function _gwSum(player) {
  const gws = player.xpByGw;
  if (!gws || !gws.length) return player.proj * 5;
  return gws.reduce((s, g) => s + g.xp, 0);
}

function computeTopTransfers(mySquad, rivalSquad, pool, rivalFirstName, useMultiGw = false) {
  // ── FPL rule helpers ──────────────────────────────────────────────────────
  // Normalise IDs: strip any "p_" prefix mangling so pool IDs always match
  const normalId = id => (id || '').replace(/^p_/, 'p');
  const myIds = new Set(mySquad.map(p => normalId(p.id)));

  // Club counts across full 15-man squad
  const clubCount = {};
  mySquad.forEach(p => { clubCount[p.club] = (clubCount[p.club] || 0) + 1; });

  const rivalIds = new Set(rivalSquad.slice(0, 11).map(p => normalId(p.id)));
  const starters = mySquad.filter(p => p.startIdx < 11);
  const recs     = [];
  const itb      = 1.5; // £1.5m budget wiggle
  const rName    = rivalFirstName || 'Your rival';

  const score = p => useMultiGw ? _gwSum(p) : p.proj;

  for (const out of starters) {
    const candidates = pool.filter(p => {
      const pid = normalId(p.id);
      // 1. Must be same position
      if (p.pos !== out.pos) return false;
      // 2. Can't bring in a player already in the squad
      if (myIds.has(pid)) return false;
      // 3. Budget: incoming price ≤ outgoing price + ITB
      if (p.price - out.price > itb) return false;
      // 4. Max 3 players from same club (net change: -1 out.club, +1 inP.club)
      //    If same club as out player, club count stays the same — always fine
      //    If different club, new count = current count + 1, must be ≤ 3
      if (p.club !== out.club && (clubCount[p.club] || 0) >= 3) return false;
      return true;
    });
    for (const inP of candidates) {
      const delta    = score(inP) - score(out);
      if (delta <= 0.1) continue;

      const rivalHas = rivalIds.has(inP.id);
      const isBlank  = out.proj < 1.5; // very low xP ≈ blank gameweek

      let description;
      if (isBlank) {
        description = `${out.name} has a blank gameweek. ${inP.name} plays and scores.`;
      } else if (rivalHas) {
        description = `${rName} owns ${inP.name}. Bringing them in removes a key differential against you.`;
      } else if (useMultiGw) {
        description = `${inP.name} projects ${_gwSum(inP).toFixed(1)} pts over 5 GWs vs ${_gwSum(out).toFixed(1)} for ${out.name} — a +${delta.toFixed(1)} pt cumulative gain.`;
      } else {
        description = `${inP.name} (${inP.proj.toFixed(1)} xP) outprojects ${out.name} (${out.proj.toFixed(1)} xP) — a +${delta.toFixed(1)} pt gain this GW.`;
      }

      recs.push({ in: inP, out, delta, rivalHas, isBlank, description });
    }
  }

  // Priority order: blank dodge > catch rival > pure upgrade; within tier → highest delta first
  recs.sort((a, b) => {
    const pri = r => r.isBlank ? 3 : r.rivalHas ? 2 : 1;
    return pri(b) - pri(a) || b.delta - a.delta;
  });

  // Deduplicate: keep best rec per (out player) so cards stay varied
  const seen = new Set();
  return recs.filter(r => {
    if (seen.has(r.out.id)) return false;
    seen.add(r.out.id);
    return true;
  });
}

// League switcher dropdown for the header
function LeagueSwitcher({ current, onSelect }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef();

  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const cur = window.MY_LEAGUES.find(l => l.id === current) || window.MY_LEAGUES[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px 6px 10px',
          background: open ? 'rgba(107, 53, 83, 0.08)' : 'rgba(60, 45, 68, 0.04)',
          border: '1px solid rgba(60, 45, 68, 0.08)',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 500,
          color: '#2a2230',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: '50%',
          background: cur.isGlobal ? '#6b5a72' : 'linear-gradient(135deg, #c97a54, #8a4a3a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 9, fontWeight: 700,
        }}>{cur.isGlobal ? '⊕' : cur.name[0]}</div>
        <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cur.name}
        </span>
        <span style={{ fontSize: 10, color: '#8a7a90' }}>
          #{cur.myRank.toLocaleString()}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          minWidth: 320,
          background: '#FDFAF4',
          border: '1px solid rgba(60, 45, 68, 0.12)',
          borderRadius: 12,
          boxShadow: '0 12px 32px rgba(60, 30, 50, 0.15)',
          padding: 6,
          zIndex: 120,
        }}>
          <div style={{
            padding: '6px 10px',
            fontSize: 10, color: '#8a7a90', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600,
          }}>Your leagues ({window.MY_LEAGUES.length})</div>
          {window.MY_LEAGUES.map(lg => {
            const delta = lg.prevRank - lg.myRank;
            return (
              <button
                key={lg.id}
                onClick={() => { onSelect(lg.id); setOpen(false); }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: lg.id === current ? 'rgba(243, 217, 195, 0.4)' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: lg.isGlobal ? '#6b5a72' : 'linear-gradient(135deg, #c97a54, #8a4a3a)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>{lg.isGlobal ? '⊕' : lg.name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#2a2230', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {lg.name}
                    {lg.id === current && <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 3,
                      background: 'rgba(107, 53, 83, 0.1)', color: '#6b3553',
                    }}>ACTIVE</span>}
                  </div>
                  <div style={{ fontSize: 10, color: '#8a7a90', marginTop: 1 }}>
                    {lg.size.toLocaleString()} managers{lg.code ? ` · ${lg.code}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 16, color: '#3a2d44' }}>
                    #{lg.myRank.toLocaleString()}
                  </div>
                  {delta !== 0 && (
                    <div style={{ fontSize: 9, color: delta > 0 ? '#4a7a4a' : '#b85a4e', fontWeight: 600 }}>
                      {delta > 0 ? '▲' : '▼'}{Math.abs(delta).toLocaleString()}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
          <div style={{ height: 1, background: 'rgba(60, 45, 68, 0.08)', margin: '6px 0' }} />
          <button style={{
            width: '100%', padding: '8px 12px', background: 'transparent',
            border: 'none', fontFamily: 'inherit', fontSize: 12, color: '#6b3553',
            cursor: 'pointer', textAlign: 'left', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: '50%',
              background: 'rgba(107, 53, 83, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12,
            }}>+</span>
            Join or create a league
          </button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { CompareSimulator, LeagueSwitcher });
