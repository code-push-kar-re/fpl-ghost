// FPL Ghost — MVP onboarding flow
// Steps: enter → leagues → rivals → compare
// Rules: 1 rival at a time · 2 tries per session · last-try popup · hard-block modal

const PLUM  = '#6b3553';
const INK   = '#2a1a30';
const CREAM = '#FDFAF4';
const BG    = '#F2ECE3';
const MUTED = '#8a7a90';
const CORAL = '#c97a54';
const SAGE  = '#4a7a4a';
const RUST  = '#b85a4e';

// ─── Shared atoms ────────────────────────────────────────────────────────────

function MvpStepHeader({ kicker, title, sub, backLabel, onBack }) {
  return (
    <div>
      {kicker && (
        <div style={{ fontSize: 10, color: MUTED, letterSpacing: 0.7, fontWeight: 700, marginBottom: 6 }}>
          {kicker}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 42, color: INK, margin: 0,
          letterSpacing: -0.8, lineHeight: 1.1, fontWeight: 400,
        }}>{title}</h1>
        {onBack && (
          <button onClick={onBack} style={{
            background: 'transparent',
            border: '1px solid rgba(60,45,68,0.15)',
            padding: '5px 12px', borderRadius: 6,
            fontSize: 11, color: MUTED, cursor: 'pointer',
          }}>← {backLabel}</button>
        )}
      </div>
      {sub && (
        <div style={{ fontSize: 13, color: MUTED, marginTop: 8, maxWidth: 720, lineHeight: 1.55 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Top bar with step progress ───────────────────────────────────────────────

function MvpTopBar({ manager, step, onReset }) {
  const steps = [
    { id: 'enter',   label: 'Connect'  },
    { id: 'leagues', label: 'League'   },
    { id: 'rivals',  label: 'Rivals'   },
    { id: 'compare', label: 'Compare'  },
  ];
  const activeIdx = steps.findIndex(s => s.id === step);

  return (
    <header style={{
      background: CREAM,
      borderBottom: '1px solid rgba(60,45,68,0.08)',
      padding: '14px 24px',
      display: 'flex', alignItems: 'center', gap: 16,
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: `linear-gradient(135deg, ${INK}, ${PLUM})`,
          color: '#F3D9C3',
          fontFamily: "'Instrument Serif', serif",
          fontSize: 19, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>g</div>
        <div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, color: INK, lineHeight: 1 }}>
            FPL Ghost
          </div>
          <div style={{ fontSize: 9, color: MUTED, letterSpacing: 0.4, marginTop: 3, fontWeight: 600 }}>
            MVP · v0.1
          </div>
        </div>
      </div>

      {/* Step indicators */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {steps.map((s, i) => (
            <React.Fragment key={s.id}>
              {i > 0 && (
                <div style={{
                  width: 28, height: 1,
                  background: i <= activeIdx ? PLUM : 'rgba(60,45,68,0.15)',
                  transition: 'background 0.3s',
                }} />
              )}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                color: i <= activeIdx ? INK : MUTED,
                fontWeight: i === activeIdx ? 600 : 400,
                fontSize: 12,
                transition: 'all 0.2s',
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: i < activeIdx
                    ? PLUM
                    : (i === activeIdx ? INK : 'rgba(60,45,68,0.08)'),
                  color: i <= activeIdx ? '#fff' : MUTED,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                  transition: 'all 0.2s',
                }}>
                  {i < activeIdx ? '✓' : i + 1}
                </div>
                {s.label}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Manager info + switch */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        {manager && (
          <div style={{ fontSize: 12, color: MUTED }}>
            <span style={{ color: INK, fontWeight: 600 }}>{manager.team}</span>
            <span style={{ margin: '0 6px' }}>·</span>
            ID&nbsp;{manager.id}
          </div>
        )}
        {manager && (
          <button onClick={onReset} style={{
            padding: '5px 10px', fontSize: 11,
            background: 'transparent',
            border: '1px solid rgba(60,45,68,0.15)',
            borderRadius: 6, color: MUTED, cursor: 'pointer',
          }}>
            Switch ID
          </button>
        )}
      </div>
    </header>
  );
}

// ─── Hard-block upgrade modal (non-dismissable) ───────────────────────────────

function HardBlockModal() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(42,26,48,0.85)',
      backdropFilter: 'blur(10px)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: CREAM, borderRadius: 20,
        padding: '44px 36px', maxWidth: 440, width: '100%', margin: '0 20px',
        textAlign: 'center',
        boxShadow: '0 32px 80px rgba(42,26,48,0.4)',
      }}>
        {/* Ghost logo */}
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: `linear-gradient(135deg, ${INK}, ${PLUM})`,
          color: '#F3D9C3', fontFamily: "'Instrument Serif', serif",
          fontSize: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>g</div>

        <div style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 30, color: INK, lineHeight: 1.2,
        }}>
          You've used both free comparisons
        </div>

        <div style={{
          fontSize: 14, color: MUTED, marginTop: 12, lineHeight: 1.65,
        }}>
          FPL Ghost lets you benchmark 2 rivals per session on the free plan.
          Upgrade to unlock unlimited rival comparisons, deeper transfer insights,
          and multi-GW planning.
        </div>

        <div style={{
          marginTop: 28, padding: '14px 16px',
          background: 'rgba(107,53,83,0.06)',
          borderRadius: 10, marginBottom: 20,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {['Unlimited rival comparisons', 'Real-time transfer suggestions', '5-GW horizon planning', 'Chip timing intelligence'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: INK }}>
              <span style={{ color: PLUM, fontWeight: 700 }}>✓</span> {f}
            </div>
          ))}
        </div>

        <button style={{
          width: '100%', padding: '14px',
          background: `linear-gradient(135deg, ${INK}, ${PLUM})`,
          color: '#fff', border: 'none', borderRadius: 12,
          fontSize: 14, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.3,
        }}>
          Upgrade to Ghost Pro →
        </button>

        <div style={{ marginTop: 12, fontSize: 11, color: MUTED }}>
          Free comparisons reset each session.
        </div>
      </div>
    </div>
  );
}

// ─── "Last try remaining" confirmation modal ──────────────────────────────────

function LastTryModal({ onConfirm }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(42,26,48,0.55)',
      backdropFilter: 'blur(4px)',
      zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: CREAM, borderRadius: 16,
        padding: '32px 28px', maxWidth: 380, width: '100%', margin: '0 20px',
        textAlign: 'center',
        boxShadow: '0 20px 48px rgba(42,26,48,0.25)',
        border: `1px solid rgba(201,122,84,0.3)`,
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
        <div style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 26, color: INK, lineHeight: 1.2,
        }}>
          Last comparison remaining
        </div>
        <div style={{
          fontSize: 13, color: MUTED, marginTop: 10, lineHeight: 1.65,
        }}>
          This is your final free rival comparison this session.
          Pick your most important rival — make it count!
        </div>
        <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '12px',
            background: INK, color: '#fff',
            border: 'none', borderRadius: 10,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Got it — choose rival →
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: MUTED }}>
          Upgrade for unlimited comparisons
        </div>
      </div>
    </div>
  );
}

// ─── STEP 1 — Enter Team ID ───────────────────────────────────────────────────

function EnterStep({ onConnect }) {
  const [val, setVal]       = React.useState('');
  const [err, setErr]       = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const valid = val.length >= 5 && val.length <= 8;

  const tryConnect = async () => {
    if (!valid) { setErr('Enter a valid 7-digit FPL Team ID.'); return; }
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`/api/onboard?team_id=${val}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.detail || `Couldn't find Team ID ${val}. Double-check and try again.`);
        return;
      }
      const manager = await res.json();
      onConnect(manager);
    } catch (e) {
      setErr('Network error — is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade" style={{ maxWidth: 560, margin: '80px auto 0', textAlign: 'center' }}>
      <div style={{
        fontFamily: "'Instrument Serif', serif",
        fontSize: 52, color: INK, letterSpacing: -1.2, lineHeight: 1.05,
      }}>
        Enter your FPL Team ID
      </div>
      <div style={{ fontSize: 14, color: MUTED, marginTop: 14, lineHeight: 1.65 }}>
        Find it in the FPL app → <strong>Points</strong> tab, or in the URL after
        <span style={{
          color: INK, fontFamily: 'monospace', fontSize: 12, margin: '0 4px',
          background: 'rgba(60,45,68,0.06)', padding: '1px 5px', borderRadius: 3,
        }}>/entry/</span>
      </div>

      <div style={{
        marginTop: 40, background: CREAM,
        border: '1px solid rgba(60,45,68,0.08)',
        borderRadius: 14, padding: '24px 24px 20px',
      }}>
        <input
          value={val}
          onChange={e => { setVal(e.target.value.replace(/\D/g, '').slice(0, 8)); setErr(''); }}
          onKeyDown={e => { if (e.key === 'Enter' && valid) tryConnect(); }}
          placeholder="9364099"
          inputMode="numeric"
          autoFocus
          style={{
            width: '100%',
            fontFamily: "'Instrument Serif', serif",
            fontSize: 44, letterSpacing: 8, textAlign: 'center',
            padding: '10px 12px',
            background: 'transparent',
            border: `1.5px solid ${err ? RUST : 'rgba(60,45,68,0.15)'}`,
            borderRadius: 10, color: INK, outline: 'none',
            transition: 'border-color 0.2s',
          }}
        />
        <div style={{
          marginTop: 10, fontSize: 11,
          color: err ? RUST : MUTED, minHeight: 16,
        }}>
          {err || (val.length > 0 ? `${val.length} / 7 digits` : 'Your 7-digit manager ID')}
        </div>
        <button
          onClick={tryConnect}
          disabled={!valid || loading}
          style={{
            marginTop: 12, width: '100%', padding: '13px',
            background: valid && !loading ? INK : 'rgba(60,45,68,0.12)',
            color: valid && !loading ? '#fff' : MUTED,
            border: 'none', borderRadius: 10,
            fontSize: 13, fontWeight: 600, letterSpacing: 0.3,
            cursor: valid && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          {loading ? 'Connecting…' : 'Connect squad →'}
        </button>
      </div>

      <div style={{ marginTop: 20, fontSize: 11, color: MUTED }}>
        Demo: try&nbsp;
        <button
          onClick={() => setVal('9364099')}
          style={{
            background: 'rgba(107,53,83,0.08)',
            border: 'none', padding: '3px 8px', borderRadius: 4,
            color: PLUM, fontFamily: 'monospace', fontSize: 11, cursor: 'pointer',
          }}
        >9364099</button>
      </div>
    </div>
  );
}

// ─── STEP 2 — Pick a League ───────────────────────────────────────────────────

function LeaguesStep({ manager, onPick }) {
  const leagues = manager.leagues || [];

  return (
    <div className="fade">
      <MvpStepHeader
        kicker="Step 2 of 4"
        title="Pick a league"
        sub={`${leagues.length} leagues connected to ${manager.team}. Tap any to benchmark against rivals.`}
      />

      <div style={{
        marginTop: 28,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 12,
      }}>
        {leagues.map(lg => {
          const move = (lg.prev_rank || lg.my_rank) - lg.my_rank;
          return (
            <button
              key={lg.id}
              onClick={() => onPick(lg)}
              style={{
                textAlign: 'left', background: CREAM,
                border: '1px solid rgba(60,45,68,0.08)',
                borderRadius: 12, padding: 18,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(107,53,83,0.35)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(60,45,68,0.08)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ fontSize: 9, color: MUTED, letterSpacing: 0.6, fontWeight: 700 }}>
                {(lg.type || 'Invitational').toUpperCase()}
                {lg.size > 0 && (
                  <span style={{ marginLeft: 8, color: MUTED, fontWeight: 400 }}>
                    {lg.size.toLocaleString()} managers
                  </span>
                )}
              </div>
              <div style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 26, color: INK, marginTop: 4, lineHeight: 1.1,
              }}>
                {lg.name}
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 24, alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: 9, color: MUTED, letterSpacing: 0.4, fontWeight: 600 }}>
                    YOUR RANK
                  </div>
                  <div style={{
                    fontFamily: "'Instrument Serif', serif", fontSize: 22, color: INK, lineHeight: 1,
                  }}>
                    {(lg.my_rank || 0).toLocaleString()}
                    {lg.size > 0 && (
                      <span style={{ fontSize: 11, color: MUTED, marginLeft: 3 }}>
                        / {lg.size.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: MUTED, letterSpacing: 0.4, fontWeight: 600 }}>
                    MOVEMENT
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 600, lineHeight: 1, marginTop: 4,
                    color: move > 0 ? SAGE : (move < 0 ? RUST : MUTED),
                  }}>
                    {move > 0 ? '↑' : move < 0 ? '↓' : '—'}
                    {move !== 0 ? ` ${Math.abs(move).toLocaleString()}` : ' held'}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14, fontSize: 11, color: PLUM, fontWeight: 600 }}>
                Benchmark rivals →
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── STEP 3 — Pick one rival ─────────────────────────────────────────────────

function RivalsStep({ manager, league, triesUsed, onGoCompare, onBack }) {
  const [rivals, setRivals]         = React.useState([]);
  const [loading, setLoading]       = React.useState(true);
  const [fetchErr, setFetchErr]     = React.useState('');
  const [selected, setSelected]     = React.useState(null);
  // Show the "Last try" modal immediately if this is attempt 2
  const [showLastTry, setShowLastTry] = React.useState(triesUsed === 1);

  React.useEffect(() => {
    if (!league?.fpl_id) return;
    setLoading(true);
    fetch(`/api/league/${league.fpl_id}/rivals?me=${manager.id}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => { setRivals(data); setLoading(false); })
      .catch(e  => { setFetchErr(String(e)); setLoading(false); });
  }, [league?.fpl_id, manager.id]);

  const others = rivals.filter(r => !r.isMe);

  const handleSelect = (r) => {
    setSelected(prev => prev?.id === r.id ? null : r);
  };

  const handleCompare = () => {
    if (!selected) return;
    onGoCompare(selected);
  };

  return (
    <div className="fade">
      {/* Last-try warning modal */}
      {showLastTry && (
        <LastTryModal onConfirm={() => setShowLastTry(false)} />
      )}

      <MvpStepHeader
        kicker="Step 3 of 4"
        title={`Who are you chasing in ${league?.name || 'this league'}?`}
        sub="Select one rival to compare squads and get transfer recommendations."
        backLabel="Leagues"
        onBack={onBack}
      />

      {/* Selection summary + Compare CTA */}
      <div style={{
        marginTop: 20, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '12px 14px',
        background: selected ? 'rgba(107,53,83,0.06)' : CREAM,
        border: `1px solid ${selected ? 'rgba(107,53,83,0.2)' : 'rgba(60,45,68,0.08)'}`,
        borderRadius: 10, transition: 'all 0.2s',
      }}>
        {selected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              background: PLUM, color: '#fff',
              padding: '5px 12px 5px 10px', borderRadius: 20,
              fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>{selected.manager}</span>
              <button onClick={() => setSelected(null)} style={{
                background: 'rgba(255,255,255,0.2)', border: 'none',
                color: '#fff', borderRadius: '50%',
                width: 15, height: 15, fontSize: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>×</button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: MUTED }}>
            Tap a row below to select your rival
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={handleCompare}
          disabled={!selected}
          style={{
            padding: '9px 16px', fontSize: 12, fontWeight: 600,
            background: selected ? INK : 'rgba(60,45,68,0.1)',
            color: selected ? '#fff' : MUTED,
            border: 'none', borderRadius: 8,
            cursor: selected ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          Compare →
        </button>
      </div>

      {/* Rival table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>
          Loading league standings…
        </div>
      ) : fetchErr ? (
        <div style={{ padding: 20, textAlign: 'center', color: RUST, fontSize: 13 }}>
          Couldn't load standings: {fetchErr}
        </div>
      ) : rivals.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: MUTED, fontSize: 13 }}>
          No standings found for this league.
        </div>
      ) : (
        <div style={{
          background: CREAM,
          border: '1px solid rgba(60,45,68,0.08)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '44px 56px 1fr 110px 80px 80px',
            padding: '10px 16px',
            fontSize: 9, color: MUTED, letterSpacing: 0.5, fontWeight: 700,
            borderBottom: '1px solid rgba(60,45,68,0.08)',
            background: 'rgba(60,45,68,0.02)',
          }}>
            <div />
            <div>RANK</div>
            <div>MANAGER · TEAM</div>
            <div style={{ textAlign: 'right' }}>TOTAL</div>
            <div style={{ textAlign: 'right' }}>GW</div>
            <div style={{ textAlign: 'center' }}>MOVE</div>
          </div>

          {/* Rival rows */}
          {rivals.map(r => {
            const isSelected = selected?.id === r.id;
            return (
              <div
                key={r.id}
                onClick={() => !r.isMe && handleSelect(r)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '44px 56px 1fr 110px 80px 80px',
                  padding: '13px 16px', alignItems: 'center',
                  borderBottom: '1px solid rgba(60,45,68,0.05)',
                  background: r.isMe
                    ? 'rgba(107,53,83,0.04)'
                    : (isSelected ? 'rgba(201,122,84,0.08)' : 'transparent'),
                  cursor: r.isMe ? 'default' : 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!r.isMe && !isSelected) e.currentTarget.style.background = 'rgba(60,45,68,0.025)'; }}
                onMouseLeave={e => { if (!r.isMe && !isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Selection indicator */}
                <div>
                  {r.isMe ? (
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: PLUM, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, fontWeight: 700,
                    }}>YOU</div>
                  ) : (
                    <div style={{
                      width: 20, height: 20, borderRadius: 5,
                      border: isSelected ? `2px solid ${CORAL}` : '1.5px solid rgba(60,45,68,0.18)',
                      background: isSelected ? CORAL : 'transparent',
                      color: '#fff', fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSelected && '✓'}
                    </div>
                  )}
                </div>

                {/* Rank */}
                <div style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontSize: 20, color: r.isMe ? PLUM : INK,
                }}>
                  {(r.rank || 0).toLocaleString()}
                </div>

                {/* Manager + team */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                    {r.manager}
                    {r.isMe && (
                      <span style={{ color: MUTED, fontWeight: 400, marginLeft: 6 }}>(you)</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED }}>{r.team}</div>
                </div>

                {/* Total pts */}
                <div style={{
                  textAlign: 'right',
                  fontFamily: "'Instrument Serif', serif", fontSize: 18, color: INK,
                }}>
                  {(r.total || 0).toLocaleString()}
                </div>

                {/* GW pts */}
                <div style={{
                  textAlign: 'right', fontSize: 13, fontWeight: 600,
                  color: r.gw >= 60 ? SAGE : INK,
                }}>
                  {r.gw || 0}
                </div>

                {/* Movement */}
                <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600 }}>
                  {r.delta > 0 && <span style={{ color: SAGE }}>↑ {r.delta}</span>}
                  {r.delta < 0 && <span style={{ color: RUST }}>↓ {Math.abs(r.delta)}</span>}
                  {(!r.delta || r.delta === 0) && <span style={{ color: MUTED }}>—</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── STEP 4 — Compare wrapper (uses existing CompareView) ─────────────────────

function CompareWrapper({ rival, mySquad, setMySquad, rivalSquad, setRivalSquad, onBack }) {
  const jerseyStyle = window.__TWEAKS?.jerseyStyle || 'textured';
  const CV = window.CompareView;

  return (
    <div className="fade">
      {/* Back strip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20,
        padding: '12px 16px',
        background: CREAM,
        border: '1px solid rgba(60,45,68,0.08)',
        borderRadius: 10,
      }}>
        <button onClick={onBack} style={{
          background: 'transparent',
          border: '1px solid rgba(60,45,68,0.15)',
          padding: '6px 14px', borderRadius: 6,
          fontSize: 11, color: MUTED, cursor: 'pointer',
        }}>
          ← Back to Leagues
        </button>

        {rival && (
          <div style={{ fontSize: 12, color: MUTED }}>
            Benchmarking vs{' '}
            <span style={{ color: INK, fontWeight: 600 }}>{rival.manager}</span>
            {rival.team && ` · ${rival.team}`}
          </div>
        )}
      </div>

      {/* Full compare view */}
      {CV ? (
        <CV
          mySquad={mySquad}
          setMySquad={setMySquad}
          rivalSquad={rivalSquad}
          setRivalSquad={setRivalSquad}
          jerseyStyle={jerseyStyle}
        />
      ) : (
        <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>
          Compare view not available. Ensure compare.jsx is loaded.
        </div>
      )}
    </div>
  );
}

// ─── MvpApp state machine ─────────────────────────────────────────────────────

function MvpApp() {
  const [step, setStep]   = React.useState('enter');
  const [manager, setManager] = React.useState(null);
  const [league, setLeague]   = React.useState(null);
  const [rival, setRival]     = React.useState(null);
  const [triesUsed, setTriesUsed]   = React.useState(0);
  const [showHardBlock, setShowHardBlock] = React.useState(false);
  const [mySquad, setMySquad]         = React.useState(window.MY_SQUAD || []);
  const [rivalSquad, setRivalSquad]   = React.useState(window.RIVAL_SQUAD || []);

  const handleConnect = (m) => { setManager(m); setStep('leagues'); };

  const handlePickLeague = (lg) => { setLeague(lg); setStep('rivals'); };

  const handleGoCompare = (selectedRival) => {
    setRival(selectedRival);
    setTriesUsed(prev => prev + 1);
    setStep('compare');
  };

  const handleBackFromCompare = () => {
    if (triesUsed >= 2) {
      setShowHardBlock(true);
    } else {
      setStep('leagues');
    }
  };

  const reset = () => {
    setStep('enter');
    setManager(null);
    setLeague(null);
    setRival(null);
    setTriesUsed(0);
    setShowHardBlock(false);
  };

  if (showHardBlock) {
    return <HardBlockModal />;
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: INK }}>
      <MvpTopBar manager={manager} step={step} onReset={reset} />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 80px' }}>
        {step === 'enter' && (
          <EnterStep onConnect={handleConnect} />
        )}

        {step === 'leagues' && manager && (
          <LeaguesStep manager={manager} onPick={handlePickLeague} />
        )}

        {step === 'rivals' && manager && league && (
          <RivalsStep
            manager={manager}
            league={league}
            triesUsed={triesUsed}
            onGoCompare={handleGoCompare}
            onBack={() => setStep('leagues')}
          />
        )}

        {step === 'compare' && (
          <CompareWrapper
            rival={rival}
            mySquad={mySquad}
            setMySquad={setMySquad}
            rivalSquad={rivalSquad}
            setRivalSquad={setRivalSquad}
            onBack={handleBackFromCompare}
          />
        )}
      </main>
    </div>
  );
}

// Mount — MvpApp takes over the root (app.jsx is not loaded in MVP HTML)
ReactDOM.createRoot(document.getElementById('root')).render(<MvpApp />);
