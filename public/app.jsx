// Main app shell — nav, header, Tweaks integration

function App() {
  const [mySquad, setMySquad] = React.useState(window.MY_SQUAD);
  const [rivalSquad, setRivalSquad] = React.useState(window.RIVAL_SQUAD);
  const [view, setView] = React.useState(() => localStorage.getItem('fpl-view') || 'compare');
  const [activeGW, setActiveGW] = React.useState(1);
  const [activeLeague, setActiveLeague] = React.useState(() => localStorage.getItem('fpl-league') || 'lg1');
  const [jerseyStyle, setJerseyStyle] = React.useState(() => window.__TWEAKS?.jerseyStyle || 'textured');
  const [tweaksOpen, setTweaksOpen] = React.useState(false);

  React.useEffect(() => { localStorage.setItem('fpl-view', view); }, [view]);
  React.useEffect(() => { localStorage.setItem('fpl-league', activeLeague); }, [activeLeague]);

  // Tweaks protocol
  React.useEffect(() => {
    const handler = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const updateJerseyStyle = (s) => {
    setJerseyStyle(s);
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits: { jerseyStyle: s }
    }, '*');
  };

  const views = {
    compare:   { label: 'Compare',   icon: '⇌' },
    lineup:    { label: 'Lineup',    icon: '◉' },
    transfers: { label: 'Transfers', icon: '↔' },
    league:    { label: 'League',    icon: '☰' },
    planner:   { label: 'Planner',   icon: '◈' },
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F2ECE3',
      fontFamily: 'Inter, -apple-system, sans-serif',
      color: '#2a2230',
    }}>
      <Header view={view} setView={setView} views={views} activeLeague={activeLeague} setActiveLeague={setActiveLeague} />

      <main style={{ maxWidth: 1440, margin: '0 auto' }}>
        {view === 'compare' && (
          <window.CompareView
            mySquad={mySquad}
            rivalSquad={rivalSquad}
            setMySquad={setMySquad}
            setRivalSquad={setRivalSquad}
            jerseyStyle={jerseyStyle}
          />
        )}
        {view === 'lineup' && (
          <LineupOnly mySquad={mySquad} setMySquad={setMySquad} jerseyStyle={jerseyStyle} />
        )}
        {view === 'transfers' && (
          <window.TransfersView
            mySquad={mySquad}
            setMySquad={setMySquad}
            rivalSquad={rivalSquad}
            jerseyStyle={jerseyStyle}
          />
        )}
        {view === 'league' && (
          <window.LeagueView
            mySquad={mySquad}
            rivalSquad={rivalSquad}
            onSelectRival={(row) => {
              if (row.id === 'rival') { setView('compare'); }
            }}
          />
        )}
        {view === 'planner' && (
          <window.PlannerView
            mySquad={mySquad}
            setMySquad={setMySquad}
            jerseyStyle={jerseyStyle}
            activeGW={activeGW}
            setActiveGW={setActiveGW}
          />
        )}
      </main>

      {tweaksOpen && (
        <TweaksPanel
          jerseyStyle={jerseyStyle}
          setJerseyStyle={updateJerseyStyle}
          onClose={() => {
            setTweaksOpen(false);
            window.parent.postMessage({ type: '__edit_mode_close' }, '*');
          }}
        />
      )}
    </div>
  );
}

function Header({ view, setView, views, activeLeague, setActiveLeague }) {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(242, 236, 227, 0.92)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(60, 45, 68, 0.08)',
    }}>
      <div style={{
        maxWidth: 1440,
        margin: '0 auto',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #3a2d44 0%, #6b3553 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#F3D9C3',
            fontFamily: "'Instrument Serif', serif",
            fontSize: 20,
            lineHeight: 1,
            flexShrink: 0,
          }}>g</div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: 20,
              color: '#2a1a30',
              lineHeight: 1.1,
              letterSpacing: -0.3,
              whiteSpace: 'nowrap',
            }}>FPL Ghost</div>
            <div style={{
              fontSize: 10,
              color: '#8a7a90',
              letterSpacing: 0.4,
              marginTop: 3,
              whiteSpace: 'nowrap',
              fontWeight: 500,
            }}>
              BENCHMARK · GW1 · SAT 28 APR
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{
          display: 'flex',
          background: 'rgba(60, 45, 68, 0.05)',
          borderRadius: 10,
          padding: 3,
          marginLeft: 20,
        }}>
          {Object.entries(views).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              style={{
                background: view === key ? '#FDFAF4' : 'transparent',
                color: view === key ? '#2a1a30' : '#6b5a72',
                border: 'none',
                padding: '7px 16px',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: view === key ? 600 : 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: view === key ? '0 1px 3px rgba(60, 30, 50, 0.08)' : 'none',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ fontSize: 12, opacity: 0.6 }}>{meta.icon}</span>
              {meta.label}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <window.LeagueSwitcher current={activeLeague} onSelect={setActiveLeague} />

        <window.LiveTicker />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={{
            background: 'transparent',
            border: '1px solid rgba(60, 45, 68, 0.12)',
            padding: '7px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            color: '#2a2230',
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M5 12h14M5 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Actions
          </button>
          <div style={{
            width: 32, height: 32,
            borderRadius: '50%',
            background: '#6b3553',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>TM</div>
        </div>
      </div>
    </header>
  );
}

function LineupOnly({ mySquad, setMySquad, jerseyStyle }) {
  return (
    <div style={{ padding: '20px 24px 40px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 4,
        gap: 20,
        flexWrap: 'wrap',
      }}>
        <h2 style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 38,
          fontWeight: 400,
          color: '#3a2d44',
          margin: 0,
          letterSpacing: -0.8,
          lineHeight: 1,
          flexShrink: 0,
        }}>Lineup editor</h2>
        <div style={{ fontSize: 13, color: '#8a7a90', textAlign: 'right' }}>
          Tap a player → set captain, VC, or swap with bench
        </div>
      </div>

      <div style={{
        marginTop: 20,
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        gap: 24,
      }}>
        <div style={{
          background: '#FDFAF4',
          border: '1px solid rgba(60, 45, 68, 0.08)',
          borderRadius: 16,
          padding: '4px 0 20px',
        }}>
          <window.PitchView squad={mySquad} setSquad={setMySquad} jerseyStyle={jerseyStyle} />
        </div>

        <LineupSidebar squad={mySquad} />
      </div>
    </div>
  );
}

function LineupSidebar({ squad }) {
  const proj = window.calculateProjection(squad);
  const captain = squad.find(p => p.captain);
  const vice = squad.find(p => p.vice);
  const starters = squad.slice(0, 11);
  const totalValue = squad.reduce((s, p) => s + p.price, 0) + 0.5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        background: 'linear-gradient(135deg, #F3D9C3 0%, #EAC3A7 100%)',
        borderRadius: 14,
        padding: 20,
      }}>
        <div style={{ fontSize: 11, color: '#7a5548', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 500 }}>
          Projected points · GW1
        </div>
        <div style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 62,
          color: '#2a1a30',
          lineHeight: 0.95,
          marginTop: 8,
          letterSpacing: -2,
        }}>
          {proj.toFixed(1)}
          <span style={{ fontSize: 18, color: '#7a5548', marginLeft: 10, letterSpacing: 0 }}>pts</span>
        </div>
        <div style={{ fontSize: 12, color: '#7a5548', marginTop: 6 }}>
          Captain {captain?.name} × 2 applied
        </div>
      </div>

      <div style={{
        background: '#FDFAF4',
        border: '1px solid rgba(60, 45, 68, 0.08)',
        borderRadius: 12,
        padding: 16,
      }}>
        <div style={{ fontSize: 11, color: '#8a7a90', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 500, marginBottom: 10 }}>
          Captaincy
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#F5E9C8', border: '1px solid #1C1B1F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: '#1C1B1F' }}>C</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{captain?.name || '—'}</div>
            <div style={{ fontSize: 11, color: '#8a7a90' }}>{captain ? `${(captain.proj * 2).toFixed(1)} pts (×2)` : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid rgba(60,45,68,0.06)' }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#F5E9C8', border: '1px solid #1C1B1F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10, color: '#1C1B1F' }}>VC</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{vice?.name || '—'}</div>
            <div style={{ fontSize: 11, color: '#8a7a90' }}>{vice ? `${vice.proj.toFixed(1)} pts (backup)` : ''}</div>
          </div>
        </div>
      </div>

      <div style={{
        background: '#FDFAF4',
        border: '1px solid rgba(60, 45, 68, 0.08)',
        borderRadius: 12,
        padding: 16,
      }}>
        <div style={{ fontSize: 11, color: '#8a7a90', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 500, marginBottom: 10 }}>
          Squad value
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
          <span style={{ color: '#8a7a90' }}>Starting XI</span>
          <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>£{starters.reduce((s, p) => s + p.price, 0).toFixed(1)}m</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
          <span style={{ color: '#8a7a90' }}>Bench</span>
          <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>£{squad.slice(11).reduce((s, p) => s + p.price, 0).toFixed(1)}m</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
          <span style={{ color: '#8a7a90' }}>ITB</span>
          <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>£0.5m</span>
        </div>
        <div style={{ height: 1, background: 'rgba(60,45,68,0.08)', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Total</span>
          <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: '#3a2d44' }}>£{totalValue.toFixed(1)}m</span>
        </div>
      </div>

      <div style={{
        background: '#FDFAF4',
        border: '1px solid rgba(60, 45, 68, 0.08)',
        borderRadius: 12,
        padding: 16,
      }}>
        <div style={{ fontSize: 11, color: '#8a7a90', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 500, marginBottom: 10 }}>
          Top projected
        </div>
        {[...starters].sort((a, b) => (b.proj * (b.captain ? 2 : 1)) - (a.proj * (a.captain ? 2 : 1))).slice(0, 4).map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid rgba(60,45,68,0.04)' }}>
            <window.Jersey club={p.club} style="minimal" size={24} />
            <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{p.name}</div>
            <div style={{
              fontFamily: "'Instrument Serif', serif", fontSize: 16, color: '#3a2d44',
            }}>{(p.proj * (p.captain ? 2 : 1)).toFixed(1)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TweaksPanel({ jerseyStyle, setJerseyStyle, onClose }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      width: 300,
      background: '#FDFAF4',
      border: '1px solid rgba(60, 45, 68, 0.15)',
      borderRadius: 14,
      boxShadow: '0 12px 32px rgba(60, 30, 50, 0.18)',
      zIndex: 100,
      fontFamily: 'Inter, sans-serif',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(60, 45, 68, 0.08)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2230' }}>Tweaks</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a7a90', cursor: 'pointer', fontSize: 16 }}>×</button>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 11, color: '#8a7a90', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 500, marginBottom: 8 }}>
          Jersey style
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {['flat', 'textured', 'minimal'].map(s => (
            <button
              key={s}
              onClick={() => setJerseyStyle(s)}
              style={{
                background: jerseyStyle === s ? '#6b3553' : 'rgba(60, 45, 68, 0.04)',
                color: jerseyStyle === s ? '#fff' : '#2a2230',
                border: 'none',
                padding: '14px 8px 10px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textTransform: 'capitalize',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <window.Jersey club="LIV" style={s} size={32} />
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
