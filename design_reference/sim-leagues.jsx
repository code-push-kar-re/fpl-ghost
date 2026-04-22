// Live transfer simulator — inline in Compare view
// Lets user preview swaps on their squad and see win-prob delta live.

function CompareSimulator({ mySquad, setMySquad, rivalSquad, jerseyStyle }) {
  const [simActive, setSimActive] = React.useState(false);
  const [outgoing, setOutgoing] = React.useState(null);
  const [incoming, setIncoming] = React.useState(null);
  const [search, setSearch] = React.useState('');

  const baseSquad = React.useMemo(() => [...mySquad], [mySquad]);
  const baseProj = window.calculateProjection(baseSquad);
  const rivalProj = window.calculateProjection(rivalSquad);
  const baseWinProb = window.calculateWinProb(baseProj, rivalProj, 15.2, 16.8);

  // Apply simulated swap to preview squad
  const previewSquad = React.useMemo(() => {
    if (!outgoing || !incoming) return baseSquad;
    return baseSquad.map(p => p.id === outgoing.id ? {
      ...incoming,
      id: `sim_${incoming.id}`,
      captain: p.captain, vice: p.vice, startIdx: p.startIdx,
      last: incoming.name.toUpperCase(),
    } : p);
  }, [baseSquad, outgoing, incoming]);

  const previewProj = window.calculateProjection(previewSquad);
  const previewWinProb = window.calculateWinProb(previewProj, rivalProj, 15.2, 16.8);
  const projDelta = previewProj - baseProj;
  const winProbDelta = previewWinProb - baseWinProb;

  const pool = window.PLAYER_POOL.filter(p =>
    !baseSquad.some(s => s.name === p.name) &&
    (!outgoing || p.pos === outgoing.pos) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.club.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => b.proj - a.proj);

  const applyTransfer = () => {
    if (!outgoing || !incoming) return;
    const newPlayer = {
      ...incoming,
      id: `p_${incoming.id}_${Date.now()}`,
      last: incoming.name.toUpperCase(),
      captain: outgoing.captain,
      vice: outgoing.vice,
      startIdx: outgoing.startIdx,
      status: incoming.status || 'a',
    };
    setMySquad(prev => prev.map(p => p.id === outgoing.id ? newPlayer : p));
    setOutgoing(null);
    setIncoming(null);
    setSimActive(false);
  };

  return (
    <div style={{
      background: '#FDFAF4',
      border: '1px solid rgba(60, 45, 68, 0.08)',
      borderRadius: 14,
      marginTop: 16,
      overflow: 'hidden',
    }}>
      {/* Collapsed header */}
      <button
        onClick={() => setSimActive(!simActive)}
        style={{
          width: '100%',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: simActive ? 'rgba(243, 217, 195, 0.3)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
          borderBottom: simActive ? '1px solid rgba(60, 45, 68, 0.08)' : 'none',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, #F3D9C3, #EAC3A7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#8a5548', fontSize: 14, fontWeight: 700,
        }}>↔</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2230' }}>
            Transfer simulator
            {!simActive && <span style={{ fontSize: 11, color: '#8a7a90', fontWeight: 400, marginLeft: 8 }}>
              Preview any swap, see live win-prob change
            </span>}
          </div>
          {simActive && outgoing && (
            <div style={{ fontSize: 11, color: '#8a7a90', marginTop: 2 }}>
              Sending out {outgoing.name} · pick a replacement below
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, color: '#8a7a90', fontWeight: 500 }}>
          {simActive ? 'Close ×' : 'Open →'}
        </span>
      </button>

      {simActive && (
        <div style={{ padding: 16 }}>
          {/* Step 1: pick outgoing */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#b85a4e', fontWeight: 700, letterSpacing: 0.6, marginBottom: 8 }}>
              1 · SELECT PLAYER TO REMOVE
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {baseSquad.slice(0, 11).map(p => (
                <button
                  key={p.id}
                  onClick={() => { setOutgoing(p); setIncoming(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 10px',
                    background: outgoing?.id === p.id ? '#6b3553' : 'rgba(60, 45, 68, 0.04)',
                    color: outgoing?.id === p.id ? '#fff' : '#2a2230',
                    border: 'none',
                    borderRadius: 20,
                    fontSize: 11, fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.name}
                  <span style={{ fontSize: 9, opacity: 0.7 }}>£{p.price.toFixed(1)}</span>
                  <window.StatusPill player={p} />
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: pick incoming */}
          {outgoing && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 10, color: '#4a7a4a', fontWeight: 700, letterSpacing: 0.6, marginBottom: 8,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>2 · PICK REPLACEMENT ({window.POS_LABELS[outgoing.pos]} ONLY)</span>
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    fontSize: 11, padding: '4px 8px',
                    border: '1px solid rgba(60, 45, 68, 0.12)',
                    borderRadius: 6, fontFamily: 'inherit',
                    background: '#FDFAF4', outline: 'none', width: 140,
                  }}
                />
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 6,
                maxHeight: 200, overflowY: 'auto',
              }}>
                {pool.slice(0, 12).map(p => {
                  const priceDiff = p.price - outgoing.price;
                  const affordable = priceDiff <= 0.5;
                  const rivalHas = rivalSquad.slice(0, 11).some(r => r.name === p.name);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setIncoming(p)}
                      disabled={!affordable}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: 8,
                        background: incoming?.id === p.id
                          ? 'rgba(74, 122, 74, 0.1)'
                          : (affordable ? 'rgba(60, 45, 68, 0.02)' : 'rgba(60, 45, 68, 0.015)'),
                        border: incoming?.id === p.id ? '1px solid rgba(74, 122, 74, 0.4)' : '1px solid transparent',
                        borderRadius: 6,
                        cursor: affordable ? 'pointer' : 'not-allowed',
                        opacity: affordable ? 1 : 0.4,
                        fontFamily: 'inherit', textAlign: 'left',
                      }}
                    >
                      <window.Jersey club={p.club} style="minimal" size={24} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#2a2230', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                          {rivalHas && <span style={{ fontSize: 8, marginLeft: 4, color: '#b85a4e' }}>●</span>}
                        </div>
                        <div style={{ fontSize: 10, color: '#8a7a90' }}>
                          £{p.price.toFixed(1)} · {p.proj.toFixed(1)}pts
                        </div>
                      </div>
                      <div style={{
                        fontSize: 10, fontWeight: 700,
                        color: p.proj - outgoing.proj >= 0 ? '#4a7a4a' : '#b85a4e',
                      }}>
                        {p.proj - outgoing.proj >= 0 ? '+' : ''}{(p.proj - outgoing.proj).toFixed(1)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live preview */}
          {outgoing && incoming && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(243, 217, 195, 0.4) 0%, rgba(234, 195, 167, 0.2) 100%)',
              border: '1px solid rgba(201, 122, 84, 0.2)',
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
              display: 'grid',
              gridTemplateColumns: 'auto 1fr 1fr 1fr',
              gap: 16,
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <window.Jersey club={outgoing.club} style="minimal" size={26} />
                <span style={{ color: '#8a6656', fontSize: 16 }}>→</span>
                <window.Jersey club={incoming.club} style={jerseyStyle} size={30} />
              </div>
              <SimStat label="Proj pts Δ" value={`${projDelta >= 0 ? '+' : ''}${projDelta.toFixed(1)}`} positive={projDelta >= 0} />
              <SimStat label="Win prob Δ" value={`${winProbDelta >= 0 ? '+' : ''}${(winProbDelta * 100).toFixed(1)}pp`} positive={winProbDelta >= 0} />
              <SimStat label="New win prob" value={`${(previewWinProb * 100).toFixed(1)}%`} />
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setOutgoing(null); setIncoming(null); setSimActive(false); }}
              style={{
                padding: '8px 14px', background: 'transparent',
                border: '1px solid rgba(60, 45, 68, 0.12)',
                borderRadius: 8, fontSize: 12, color: '#6b5a72',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Cancel</button>
            <button
              onClick={applyTransfer}
              disabled={!outgoing || !incoming || (incoming.price - outgoing.price) > 0.5}
              style={{
                padding: '8px 14px',
                background: outgoing && incoming ? '#2a1a30' : 'rgba(60, 45, 68, 0.15)',
                color: outgoing && incoming ? '#fff' : '#8a7a90',
                border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: outgoing && incoming ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >Apply transfer</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SimStat({ label, value, positive }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#8a7a90', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'Instrument Serif', serif",
        fontSize: 22,
        lineHeight: 1,
        color: positive === undefined ? '#3a2d44' : (positive ? '#4a7a4a' : '#b85a4e'),
      }}>{value}</div>
    </div>
  );
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
