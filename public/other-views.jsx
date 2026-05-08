// Mini-league leaderboard + Planner (GW timeline) + Live ticker

function LeagueView({ mySquad, rivalSquad, onSelectRival }) {
  return (
    <div style={{ padding: '20px 24px 40px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 18,
      }}>
        <div>
          <h2 style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 38,
            fontWeight: 400,
            color: '#3a2d44',
            margin: 0,
            letterSpacing: -0.8,
          }}>Chips & Crisps FC</h2>
          <div style={{ fontSize: 13, color: '#8a7a90', marginTop: 4 }}>
            12 managers · GW1 · Invite code <span style={{
              background: 'rgba(123, 60, 96, 0.08)',
              padding: '2px 8px',
              borderRadius: 4,
              fontFamily: 'monospace',
              color: '#6b3553',
              marginLeft: 4,
            }}>7k3n-4fq2</span>
          </div>
        </div>
        <button style={{
          background: '#2a1a30',
          color: '#fff',
          border: 'none',
          padding: '10px 16px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}>+ Challenge</button>
      </div>

      {/* Leaderboard table */}
      <div style={{
        background: '#FDFAF4',
        border: '1px solid rgba(60, 45, 68, 0.08)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '60px 1fr 160px 100px 100px 140px',
          padding: '12px 16px',
          fontSize: 11,
          color: '#8a7a90',
          fontWeight: 500,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          borderBottom: '1px solid rgba(60, 45, 68, 0.08)',
        }}>
          <div>Rank</div>
          <div>Manager · Team</div>
          <div>GW1 projected</div>
          <div style={{ textAlign: 'right' }}>GW pts</div>
          <div style={{ textAlign: 'right' }}>Total</div>
          <div style={{ textAlign: 'right' }}>Actions</div>
        </div>
        {window.MINI_LEAGUE.map(row => (
          <LeagueRow key={row.id} row={row} onSelectRival={onSelectRival} />
        ))}
      </div>
    </div>
  );
}

function LeagueRow({ row, onSelectRival }) {
  const [hover, setHover] = React.useState(false);
  const rankDelta = row.prev - row.rank;
  // Pseudo-random but deterministic projection per id
  const seed = row.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const proj = 55 + ((seed * 7) % 20);
  const probBar = 35 + ((seed * 11) % 60);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr 160px 100px 100px 140px',
        padding: '14px 16px',
        alignItems: 'center',
        borderBottom: '1px solid rgba(60, 45, 68, 0.04)',
        background: row.isMe ? 'rgba(243, 217, 195, 0.3)' : (hover ? 'rgba(60, 45, 68, 0.02)' : 'transparent'),
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 24,
          color: row.isMe ? '#6b3553' : '#3a2d44',
          lineHeight: 1,
        }}>{row.rank}</span>
        {rankDelta !== 0 && (
          <span style={{
            fontSize: 10,
            color: rankDelta > 0 ? '#4a7a4a' : '#b85a4e',
            fontWeight: 600,
          }}>{rankDelta > 0 ? '▲' : '▼'}{Math.abs(rankDelta)}</span>
        )}
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: row.isMe ? '#6b3553' : (row.id === 'rival' ? '#c97a54' : '#b8a8be'),
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700,
          }}>{row.manager.split(' ').map(w => w[0]).join('')}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2230' }}>
              {row.team}
              {row.isMe && <span style={{
                marginLeft: 8, fontSize: 10, color: '#6b3553', background: 'rgba(123, 60, 96, 0.1)',
                padding: '1px 6px', borderRadius: 3, fontWeight: 500,
              }}>YOU</span>}
            </div>
            <div style={{ fontSize: 11, color: '#8a7a90' }}>{row.manager}</div>
          </div>
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 6, background: 'rgba(60,45,68,0.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${probBar}%`,
              height: '100%',
              background: row.isMe ? '#6b3553' : '#b8a8be',
              borderRadius: 3,
            }} />
          </div>
          <span style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 16,
            color: '#3a2d44',
            minWidth: 36,
            textAlign: 'right',
          }}>{proj.toFixed(1)}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', fontFamily: "'Instrument Serif', serif", fontSize: 20, color: '#3a2d44' }}>
        {row.gw}
      </div>
      <div style={{ textAlign: 'right', fontFamily: "'Instrument Serif', serif", fontSize: 20, color: '#2a2230' }}>
        {row.total.toLocaleString()}
      </div>
      <div style={{ textAlign: 'right' }}>
        {!row.isMe && (
          <button
            onClick={() => onSelectRival(row)}
            style={{
              background: row.id === 'rival' ? '#6b3553' : 'transparent',
              color: row.id === 'rival' ? '#fff' : '#6b3553',
              border: row.id === 'rival' ? 'none' : '1px solid rgba(107, 53, 83, 0.3)',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {row.id === 'rival' ? '✓ Benchmarking' : 'Benchmark →'}
          </button>
        )}
      </div>
    </div>
  );
}

// --- Planner ---
function PlannerView({ mySquad, setMySquad, jerseyStyle, activeGW, setActiveGW }) {
  return (
    <div style={{ padding: '20px 24px 40px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 4,
      }}>
        <h2 style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 38,
          fontWeight: 400,
          color: '#3a2d44',
          margin: 0,
          letterSpacing: -0.8,
        }}>Transfer planner</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            fontSize: 12, color: '#8a7a90',
            padding: '6px 10px',
            background: 'rgba(60,45,68,0.04)',
            borderRadius: 6,
          }}>Absolute ⇌ Relative</div>
          <button style={{
            background: '#2a1a30', color: '#fff', border: 'none',
            padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}>⟳ Optimise</button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#8a7a90', marginBottom: 22 }}>
        Plan 5 gameweeks ahead · chips, transfers, and captain picks
      </div>

      {/* Timeline */}
      <Timeline activeGW={activeGW} setActiveGW={setActiveGW} />

      {/* Base scenario pitch */}
      <div style={{
        marginTop: 28,
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: 20,
      }}>
        <div style={{
          background: '#FDFAF4',
          border: '1px solid rgba(60, 45, 68, 0.08)',
          borderRadius: 16,
          padding: '4px 0 20px',
        }}>
          <PitchView
            squad={mySquad}
            setSquad={setMySquad}
            jerseyStyle={jerseyStyle}
            title={`GW${activeGW}`}
          />
        </div>

        {/* Sidebar: scenario summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            background: '#FDFAF4',
            border: '1px solid rgba(60, 45, 68, 0.08)',
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{ fontSize: 11, color: '#8a7a90', letterSpacing: 0.4, textTransform: 'uppercase' }}>Scenario</div>
            <div style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: 26, color: '#3a2d44', marginTop: 2, marginBottom: 10,
            }}>Base scenario</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <SummaryRow label="GW1-5 projected" value="313.2 pts" />
              <SummaryRow label="Transfers used" value="3 of 5" />
              <SummaryRow label="Hits taken" value="−0 pts" />
              <SummaryRow label="Chips scheduled" value="TC (GW4)" />
            </div>
          </div>

          <div style={{
            background: '#FDFAF4',
            border: '1px solid rgba(60, 45, 68, 0.08)',
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{ fontSize: 11, color: '#8a7a90', letterSpacing: 0.4, textTransform: 'uppercase' }}>Chip planner</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              <ChipSlot label="Wildcard" used={false} gw="—" />
              <ChipSlot label="Bench Boost" used={false} gw="—" />
              <ChipSlot label="Triple Captain" used={true} gw="GW4" />
              <ChipSlot label="Free Hit" used={false} gw="—" />
            </div>
          </div>

          <div style={{
            background: '#FDFAF4',
            border: '1px solid rgba(60, 45, 68, 0.08)',
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{ fontSize: 11, color: '#8a7a90', letterSpacing: 0.4, textTransform: 'uppercase' }}>Next-5 difficulty</div>
            <div style={{ marginTop: 10 }}>
              <FixtureHeatmap squad={mySquad} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Timeline({ activeGW, setActiveGW }) {
  return (
    <div style={{
      background: '#FDFAF4',
      border: '1px solid rgba(60, 45, 68, 0.08)',
      borderRadius: 12,
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      overflowX: 'auto',
    }}>
      <div style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #F3D9C3, #EAC3A7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        fontSize: 11, color: '#6b3553', fontWeight: 600,
      }}>
        Base<br />scen.
      </div>
      <div style={{ width: 28, height: 2, background: 'rgba(60,45,68,0.15)', flexShrink: 0 }} />
      {window.GW_TIMELINE.map((g, i) => (
        <React.Fragment key={g.gw}>
          <button
            onClick={() => setActiveGW(g.gw)}
            style={{
              minWidth: 90,
              padding: '10px 12px',
              background: g.gw === activeGW ? 'linear-gradient(135deg, #F3D9C3, #EAC3A7)' : 'rgba(243, 217, 195, 0.4)',
              border: g.gw === activeGW ? '1.5px solid #c97a54' : '1px solid transparent',
              borderRadius: 8,
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 11, color: '#8a6656', fontWeight: 600, letterSpacing: 0.3, display: 'flex', justifyContent: 'space-between' }}>
              <span>GW{g.gw}</span>
              {g.chip && <span style={{
                background: '#6b3553', color: '#fff', padding: '1px 5px', borderRadius: 3, fontSize: 9,
              }}>{g.chip}</span>}
            </div>
            <div style={{
              fontFamily: "'Instrument Serif', serif", fontSize: 18, color: '#3a2d44', marginTop: 2,
            }}>{g.proj.toFixed(1)} pts</div>
            <div style={{ fontSize: 10, color: '#8a7a90', marginTop: 2 }}>
              {g.ft}FT · £{g.itb.toFixed(1)} ITB
            </div>
          </button>
          {i < window.GW_TIMELINE.length - 1 && (
            <div style={{ width: 14, height: 2, background: 'rgba(60,45,68,0.1)', flexShrink: 0 }} />
          )}
        </React.Fragment>
      ))}
      <button style={{
        minWidth: 44, height: 44,
        border: '1.5px dashed rgba(60, 45, 68, 0.25)',
        background: 'transparent',
        borderRadius: 8,
        color: '#8a7a90',
        fontSize: 20,
        cursor: 'pointer',
        marginLeft: 4,
        flexShrink: 0,
      }}>+</button>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: '#8a7a90' }}>{label}</span>
      <span style={{ color: '#2a2230', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function ChipSlot({ label, used, gw }) {
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 8,
      background: used ? 'rgba(107, 53, 83, 0.08)' : 'rgba(60, 45, 68, 0.03)',
      border: used ? '1px solid rgba(107, 53, 83, 0.25)' : '1px dashed rgba(60, 45, 68, 0.15)',
    }}>
      <div style={{ fontSize: 11, color: used ? '#6b3553' : '#8a7a90', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#2a2230', marginTop: 2, fontWeight: used ? 600 : 400 }}>{gw}</div>
    </div>
  );
}

function FixtureHeatmap({ squad }) {
  const clubs = [...new Set(squad.slice(0, 11).map(p => p.club))];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(5, 1fr)', gap: 4, fontSize: 10, color: '#8a7a90', marginBottom: 2 }}>
        <div></div>
        {[1, 2, 3, 4, 5].map(g => <div key={g} style={{ textAlign: 'center' }}>GW{g}</div>)}
      </div>
      {clubs.slice(0, 6).map(c => (
        <div key={c} style={{ display: 'grid', gridTemplateColumns: '52px repeat(5, 1fr)', gap: 4, alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#2a2230' }}>{c}</div>
          {(window.FIXTURES[c] || Array(5).fill({ fdr: 3, opp: '—', h: true })).slice(0, 5).map((f, i) => (
            <FdrCell key={i} fdr={f.fdr} opp={f.opp} h={f.h} />
          ))}
        </div>
      ))}
    </div>
  );
}

function FdrCell({ fdr, opp, h }) {
  const colors = {
    1: '#3fb56b',
    2: '#8fc77a',
    3: '#e8d07a',
    4: '#e09560',
    5: '#c54b4b',
  };
  return (
    <div style={{
      height: 24,
      borderRadius: 4,
      background: colors[fdr] || '#ccc',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, color: '#fff', fontWeight: 600,
      textShadow: '0 1px 1px rgba(0,0,0,0.2)',
    }}>
      {opp}{h ? '' : ''}<span style={{ fontSize: 8, opacity: 0.7 }}>{h ? '(H)' : '(A)'}</span>
    </div>
  );
}

// --- Live ticker (appears in header when matches live) ---
function LiveTicker() {
  const liveCount = window.LIVE_MATCHES.filter(m => m.status === 'LIVE').length;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 12px',
      background: 'rgba(107, 53, 83, 0.08)',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 500,
      color: '#6b3553',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: '#c54b4b',
        animation: 'pulse 2s ease-in-out infinite',
      }} />
      LIVE · {liveCount} matches
    </div>
  );
}

Object.assign(window, { LeagueView, PlannerView, LiveTicker });
