// Transfers view — player market, filters, and recommendations
// Players are generated from a realistic pool; swap into your squad to see live projection delta.

// PLAYER_POOL is injected from data.jsx via window.PLAYER_POOL (829 real FPL players)
const PLAYER_POOL = window.PLAYER_POOL || [];

const POS_LABELS = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

function TransfersView({ mySquad, setMySquad, rivalSquad, jerseyStyle }) {
  const [posFilter, setPosFilter] = React.useState('ALL');
  const [sortBy, setSortBy] = React.useState('proj');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState(null);
  const [outgoing, setOutgoing] = React.useState(null);

  const myIds = new Set(mySquad.map(p => p.id));
  const rivalIds = new Set(rivalSquad.slice(0, 11).map(p => p.id));
  const itb = 0.5;
  const myProj = window.calculateProjection(mySquad);
  const rivalProj = window.calculateProjection(rivalSquad);
  const gap = myProj - rivalProj;

  // Filter + sort pool
  let pool = PLAYER_POOL.filter(p => !myIds.has(p.id));
  if (posFilter !== 'ALL') pool = pool.filter(p => POS_LABELS[p.pos] === posFilter);
  if (search) pool = pool.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.club.toLowerCase().includes(search.toLowerCase())
  );
  pool.sort((a, b) => {
    if (sortBy === 'proj') return b.proj - a.proj;
    if (sortBy === 'form') return b.form - a.form;
    if (sortBy === 'price_hi') return b.price - a.price;
    if (sortBy === 'price_lo') return a.price - b.price;
    if (sortBy === 'selected') return b.selected - a.selected;
    if (sortBy === 'differential') return (a.rivalHas ? 1 : 0) - (b.rivalHas ? 1 : 0) || b.proj - a.proj;
    return 0;
  });
  pool = pool.map(p => ({ ...p, rivalHas: rivalIds.has(p.id) }));

  // Compute recommendations: find best (in, out) pair
  const recommendations = computeRecommendations(mySquad, rivalSquad, PLAYER_POOL, itb);

  const doTransfer = (inPlayer, outPlayer) => {
    const newPlayer = {
      id: `p_${inPlayer.id}_${Date.now()}`,
      name: inPlayer.name,
      last: inPlayer.name.toUpperCase(),
      first: inPlayer.name,
      club: inPlayer.club,
      pos: inPlayer.pos,
      price: inPlayer.price,
      proj: inPlayer.proj,
      form: inPlayer.form,
      selected: inPlayer.selected,
      captain: outPlayer.captain,
      vice: outPlayer.vice,
      startIdx: outPlayer.startIdx,
    };
    setMySquad(prev => prev.map(p => p.id === outPlayer.id ? newPlayer : p));
    setSelected(null);
    setOutgoing(null);
  };

  return (
    <div style={{ padding: '20px 24px 40px' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4,
        gap: 16, flexWrap: 'wrap',
      }}>
        <h2 style={{
          fontFamily: "'Instrument Serif', serif", fontSize: 38, fontWeight: 400,
          color: '#3a2d44', margin: 0, letterSpacing: -0.8, lineHeight: 1, flexShrink: 0,
        }}>Transfer market</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip label={`${gap >= 0 ? '+' : ''}${gap.toFixed(1)} vs rival`} color={gap >= 0 ? '#4a7a4a' : '#b85a4e'} />
          <Chip label="1 FT · £0.5 ITB" />
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#8a7a90', marginBottom: 22 }}>
        Find the player who closes the gap on Danny. Sort by projected EV, differential edge, or form.
      </div>

      {/* Top: recommendations */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 11, color: '#8a7a90', letterSpacing: 0.4, textTransform: 'uppercase',
          fontWeight: 500, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <SparkIcon /> Top recommendations to close the gap
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {recommendations.slice(0, 3).map((rec, i) => (
            <RecCard key={i} rec={rec} onApply={() => doTransfer(rec.in, rec.out)} rank={i + 1} />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Market */}
        <div style={{
          background: '#FDFAF4', border: '1px solid rgba(60, 45, 68, 0.08)',
          borderRadius: 16, overflow: 'hidden',
        }}>
          {/* Controls */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid rgba(60, 45, 68, 0.08)',
            display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
          }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
              <input
                type="text"
                placeholder="Search player or club…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 32px',
                  border: '1px solid rgba(60, 45, 68, 0.12)',
                  borderRadius: 8,
                  fontSize: 13,
                  background: 'rgba(60, 45, 68, 0.02)',
                  fontFamily: 'inherit',
                  color: '#2a2230',
                  outline: 'none',
                }}
              />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8a7a90',
              }}>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ display: 'flex', background: 'rgba(60, 45, 68, 0.05)', borderRadius: 8, padding: 2 }}>
              {['ALL', 'GK', 'DEF', 'MID', 'FWD'].map(p => (
                <button key={p} onClick={() => setPosFilter(p)} style={{
                  padding: '6px 10px', fontSize: 11, fontWeight: 600,
                  background: posFilter === p ? '#FDFAF4' : 'transparent',
                  color: posFilter === p ? '#2a1a30' : '#6b5a72',
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: posFilter === p ? '0 1px 2px rgba(60,30,50,0.08)' : 'none',
                }}>{p}</button>
              ))}
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
              padding: '7px 10px', fontSize: 12, border: '1px solid rgba(60, 45, 68, 0.12)',
              borderRadius: 8, background: '#FDFAF4', color: '#2a2230', fontFamily: 'inherit', cursor: 'pointer',
            }}>
              <option value="proj">Sort: Projected pts</option>
              <option value="form">Sort: Form</option>
              <option value="differential">Sort: Differential edge</option>
              <option value="selected">Sort: Ownership</option>
              <option value="price_hi">Sort: Price (high)</option>
              <option value="price_lo">Sort: Price (low)</option>
            </select>
          </div>

          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 60px 70px 70px 80px 90px 110px',
            padding: '10px 16px',
            fontSize: 10, color: '#8a7a90', fontWeight: 600,
            letterSpacing: 0.4, textTransform: 'uppercase',
            background: 'rgba(60, 45, 68, 0.02)',
          }}>
            <div>Player</div>
            <div style={{ textAlign: 'right' }}>Price</div>
            <div style={{ textAlign: 'right' }}>Form</div>
            <div style={{ textAlign: 'right' }}>Proj</div>
            <div style={{ textAlign: 'right' }}>Own%</div>
            <div style={{ textAlign: 'center' }}>Rival</div>
            <div style={{ textAlign: 'right' }}>Action</div>
          </div>

          {/* Rows */}
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {pool.slice(0, 40).map(p => (
              <MarketRow
                key={p.id}
                player={p}
                jerseyStyle={jerseyStyle}
                selected={selected?.id === p.id}
                onSelect={() => setSelected(p)}
              />
            ))}
            {pool.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: '#9b8aa1', fontSize: 13 }}>
                No players match your filters.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar — selected player detail + transfer flow */}
        <TransferSidebar
          selected={selected}
          outgoing={outgoing}
          setOutgoing={setOutgoing}
          mySquad={mySquad}
          itb={itb}
          onApply={() => selected && outgoing && doTransfer(selected, outgoing)}
          onClear={() => { setSelected(null); setOutgoing(null); }}
        />
      </div>
    </div>
  );
}

function MarketRow({ player, jerseyStyle, selected, onSelect }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onSelect}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 60px 70px 70px 80px 90px 110px',
        padding: '10px 16px',
        alignItems: 'center',
        borderBottom: '1px solid rgba(60, 45, 68, 0.04)',
        cursor: 'pointer',
        background: selected ? 'rgba(243, 217, 195, 0.4)' : (hover ? 'rgba(60, 45, 68, 0.02)' : 'transparent'),
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <window.Jersey club={player.club} style={jerseyStyle} size={28} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2230' }}>{player.name}</div>
          <div style={{ fontSize: 11, color: '#8a7a90' }}>
            {window.TEAMS[player.club]?.short} · {POS_LABELS[player.pos]}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 13, color: '#2a2230', fontVariantNumeric: 'tabular-nums' }}>
        £{player.price.toFixed(1)}
      </div>
      <div style={{ textAlign: 'right', fontSize: 13, color: '#6b5a72', fontVariantNumeric: 'tabular-nums' }}>
        {player.form.toFixed(1)}
      </div>
      <div style={{
        textAlign: 'right',
        fontFamily: "'Instrument Serif', serif",
        fontSize: 18,
        color: '#3a2d44',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {player.proj.toFixed(1)}
      </div>
      <div style={{ textAlign: 'right', fontSize: 12, color: '#6b5a72' }}>
        {player.selected.toFixed(1)}%
      </div>
      <div style={{ textAlign: 'center' }}>
        {player.rivalHas ? (
          <span style={{
            fontSize: 10, fontWeight: 600,
            background: 'rgba(201, 122, 84, 0.15)',
            color: '#b85a4e',
            padding: '3px 8px', borderRadius: 4,
          }}>HAS</span>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 600,
            background: 'rgba(74, 122, 74, 0.12)',
            color: '#4a7a4a',
            padding: '3px 8px', borderRadius: 4,
          }}>DIFF</span>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <button onClick={(e) => { e.stopPropagation(); onSelect(); }} style={{
          background: selected ? '#6b3553' : 'transparent',
          color: selected ? '#fff' : '#6b3553',
          border: selected ? 'none' : '1px solid rgba(107, 53, 83, 0.3)',
          padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          {selected ? '✓ Selected' : 'Bring in →'}
        </button>
      </div>
    </div>
  );
}

function TransferSidebar({ selected, outgoing, setOutgoing, mySquad, itb, onApply, onClear }) {
  if (!selected) {
    return (
      <div style={{
        background: '#FDFAF4', border: '1px dashed rgba(60, 45, 68, 0.15)',
        borderRadius: 16, padding: 24,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', color: '#8a7a90',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(107, 53, 83, 0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#6b3553', fontSize: 20, marginBottom: 12,
        }}>↔</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#2a2230', marginBottom: 4 }}>
          Pick an incoming player
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          Click any player in the market to start a transfer. You'll see projected point impact and budget check before confirming.
        </div>
      </div>
    );
  }

  // Outgoing options = same position as incoming
  const outOptions = mySquad.filter(p => p.pos === selected.pos);
  const out = outgoing || outOptions[outOptions.length - 1];
  const priceDiff = selected.price - out.price;
  const canAfford = priceDiff <= itb;
  const projDelta = selected.proj - out.proj;
  const projCaptainBonus = out.captain ? selected.proj - out.proj : 0; // if captain, the delta is still proj diff but consider

  return (
    <div style={{
      background: '#FDFAF4', border: '1px solid rgba(60, 45, 68, 0.08)',
      borderRadius: 16, padding: 18,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#8a7a90', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>
          Transfer preview
        </div>
        <button onClick={onClear} style={{
          background: 'none', border: 'none', color: '#8a7a90', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
        }}>Clear</button>
      </div>

      {/* In */}
      <div style={{
        background: 'rgba(74, 122, 74, 0.06)',
        border: '1px solid rgba(74, 122, 74, 0.2)',
        borderRadius: 10, padding: 12, marginBottom: 10,
      }}>
        <div style={{ fontSize: 10, color: '#4a7a4a', fontWeight: 700, letterSpacing: 0.6, marginBottom: 6 }}>↑ BRINGING IN</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <window.Jersey club={selected.club} style="textured" size={38} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2a2230' }}>{selected.name}</div>
            <div style={{ fontSize: 11, color: '#8a7a90' }}>
              {window.TEAMS[selected.club]?.short} · {POS_LABELS[selected.pos]} · £{selected.price.toFixed(1)}m
            </div>
          </div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: '#4a7a4a' }}>
            {selected.proj.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Out selector */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: '#b85a4e', fontWeight: 700, letterSpacing: 0.6, marginBottom: 6 }}>↓ SENDING OUT</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {outOptions.map(p => (
            <button key={p.id} onClick={() => setOutgoing(p)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: 10,
              background: out.id === p.id ? 'rgba(184, 90, 78, 0.08)' : 'rgba(60, 45, 68, 0.02)',
              border: out.id === p.id ? '1px solid rgba(184, 90, 78, 0.3)' : '1px solid transparent',
              borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
            }}>
              <window.Jersey club={p.club} style="minimal" size={28} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#2a2230' }}>
                  {p.name} {p.captain && <span style={{ fontSize: 9, color: '#6b3553' }}>· C</span>}
                </div>
                <div style={{ fontSize: 10, color: '#8a7a90' }}>
                  £{p.price.toFixed(1)}m · {p.proj.toFixed(1)} proj
                </div>
              </div>
              {out.id === p.id && <span style={{ color: '#b85a4e', fontSize: 14 }}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{
        background: 'rgba(60, 45, 68, 0.03)',
        borderRadius: 8, padding: 12,
        display: 'flex', flexDirection: 'column', gap: 6,
        marginBottom: 12,
      }}>
        <SumRow label="Price change" value={`${priceDiff > 0 ? '+' : ''}£${priceDiff.toFixed(1)}m`} color={priceDiff > itb ? '#b85a4e' : '#2a2230'} />
        <SumRow label="ITB after" value={`£${(itb - priceDiff).toFixed(1)}m`} color={canAfford ? '#4a7a4a' : '#b85a4e'} />
        <SumRow label="Projected pts Δ" value={`${projDelta >= 0 ? '+' : ''}${projDelta.toFixed(1)} pts`} color={projDelta >= 0 ? '#4a7a4a' : '#b85a4e'} big />
        <SumRow label="Free transfers" value="1 available" />
      </div>

      <button
        disabled={!canAfford}
        onClick={onApply}
        style={{
          width: '100%',
          padding: '12px',
          background: canAfford ? '#2a1a30' : 'rgba(60, 45, 68, 0.15)',
          color: canAfford ? '#fff' : '#8a7a90',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
          cursor: canAfford ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
        }}
      >
        {canAfford ? `Confirm transfer · ${projDelta >= 0 ? '+' : ''}${projDelta.toFixed(1)} pts` : 'Not enough budget'}
      </button>
    </div>
  );
}

function SumRow({ label, value, color, big }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 11, color: '#8a7a90' }}>{label}</span>
      <span style={{
        fontSize: big ? 15 : 12, fontWeight: big ? 600 : 500,
        color: color || '#2a2230', fontVariantNumeric: 'tabular-nums',
      }}>{value}</span>
    </div>
  );
}

function RecCard({ rec, onApply, rank }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(243, 217, 195, 0.4) 0%, rgba(234, 195, 167, 0.25) 100%)',
      border: '1px solid rgba(201, 122, 84, 0.2)',
      borderRadius: 12, padding: 14,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            background: '#2a1a30', color: '#F3D9C3',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Instrument Serif', serif", fontSize: 13,
          }}>{rank}</div>
          <div style={{ fontSize: 11, color: '#8a6656', fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
            {rec.reason}
          </div>
        </div>
        <div style={{
          fontFamily: "'Instrument Serif', serif", fontSize: 22, color: '#4a7a4a',
        }}>+{rec.delta.toFixed(1)}</div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', background: 'rgba(255,255,255,0.5)', borderRadius: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
          <window.Jersey club={rec.out.club} style="minimal" size={22} />
          <div style={{ fontSize: 11, color: '#8a7a90' }}>
            <span style={{ textDecoration: 'line-through' }}>{rec.out.name}</span>
          </div>
        </div>
        <span style={{ color: '#8a6656' }}>→</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
          <window.Jersey club={rec.in.club} style="minimal" size={22} />
          <div style={{ fontSize: 12, fontWeight: 600, color: '#2a2230' }}>{rec.in.name}</div>
        </div>
      </div>
      <button onClick={onApply} style={{
        padding: '8px', background: 'transparent',
        color: '#6b3553', border: '1px solid rgba(107, 53, 83, 0.3)',
        borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
      }}>Apply this transfer</button>
    </div>
  );
}

function Chip({ label, color }) {
  return (
    <div style={{
      padding: '6px 10px',
      background: color ? `${color}18` : 'rgba(60, 45, 68, 0.05)',
      color: color || '#6b5a72',
      fontSize: 11, fontWeight: 600, borderRadius: 20,
      letterSpacing: 0.3,
    }}>{label}</div>
  );
}

function SparkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L14 9L21 10L16 15L17 22L12 18L7 22L8 15L3 10L10 9Z" fill="#c97a54" stroke="#8a6656" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  );
}

function computeRecommendations(mySquad, rivalSquad, pool, itb) {
  const myIds = new Set(mySquad.map(p => p.id));
  const rivalIds = new Set(rivalSquad.slice(0, 11).map(p => p.id));
  const starters = mySquad.slice(0, 11);
  const recs = [];

  for (const out of starters) {
    const sameposPool = pool.filter(p => p.pos === out.pos && !myIds.has(p.id));
    for (const inP of sameposPool) {
      const priceDiff = inP.price - out.price;
      if (priceDiff > itb) continue;
      const delta = inP.proj - out.proj;
      if (delta <= 0) continue;
      let reason = `Upgrade ${window.POS_LABELS?.[out.pos] || ''}`;
      if (rivalIds.has(inP.id)) reason = 'Rival differential';
      else if (!rivalIds.has(inP.id) && delta > 0.6) reason = 'Differential edge';
      else if (inP.form > 6) reason = 'Hot form pickup';
      recs.push({ in: inP, out, delta, reason });
    }
  }
  recs.sort((a, b) => b.delta - a.delta);
  return recs;
}

window.POS_LABELS = POS_LABELS;
Object.assign(window, { TransfersView, PLAYER_POOL });
