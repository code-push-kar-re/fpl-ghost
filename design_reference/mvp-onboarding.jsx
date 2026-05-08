// FPL Ghost — MVP onboarding flow (design v2)
// Steps: enter → leagues → rivals → compare → blocked
// Rules: single rival per try · 2 tries cap · last-try warning on rival click · hard upgrade gate

const PLUM  = '#6b3553';
const INK   = '#2a1a30';
const CREAM = '#FDFAF4';
const BG    = '#F2ECE3';
const MUTED = '#8a7a90';
const CORAL = '#c97a54';
const SAGE  = '#4a7a4a';
const RUST  = '#b85a4e';

const MAX_TRIES = 2;

// ─── MvpApp state machine ─────────────────────────────────────────────────────

function MvpApp() {
  const [step, setStep]             = React.useState('enter'); // enter → leagues → rivals → compare → blocked
  const [manager, setManager]       = React.useState(null);
  const [league, setLeague]         = React.useState(null);    // full league object {id, fpl_id, name, …}
  const [rival, setRival]           = React.useState(null);
  const [triesUsed, setTriesUsed]   = React.useState(0);
  const [showLastTryWarning, setShowLastTryWarning] = React.useState(false);
  const [pendingRival, setPendingRival] = React.useState(null);

  // Squad state — updated when a rival is selected so CompareView shows their real picks
  const [mySquad, setMySquad]       = React.useState(window.MY_SQUAD || []);
  const [rivalSquad, setRivalSquad] = React.useState(window.RIVAL_SQUAD || []);

  // Step 1 → 2: real API lookup via /api/onboard
  const handleConnect = (m) => {
    setManager(m);
    setStep('leagues');
    // reset tries on new session
    setTriesUsed(0);
    setRival(null);
    setLeague(null);
  };

  // Step 2 → 3
  const handlePickLeague = (lg) => { setLeague(lg); setStep('rivals'); };

  // Step 3 → 4: clicking a rival row
  const handleSelectRival = (r) => {
    if (triesUsed >= MAX_TRIES) return; // defensive
    if (triesUsed === MAX_TRIES - 1) {
      // last try — show confirmation modal first
      setPendingRival(r);
      setShowLastTryWarning(true);
    } else {
      proceedToCompare(r);
    }
  };

  const proceedToCompare = async (r) => {
    setShowLastTryWarning(false);
    setPendingRival(null);
    setRival(r);
    setTriesUsed(t => t + 1);
    // Reset squads to defaults before fetching
    setMySquad(window.MY_SQUAD || []);
    setRivalSquad(window.RIVAL_SQUAD || []);
    // Fetch this rival's real squad
    try {
      const res = await fetch(`/api/rival-squad/${r.id}`);
      if (res.ok) {
        const squad = await res.json();
        if (Array.isArray(squad) && squad.length > 0) setRivalSquad(squad);
      }
    } catch (_) { /* fall back to default RIVAL_SQUAD */ }
    setStep('compare');
  };

  // Back from compare → leagues (or blocked if tries exhausted)
  const backFromCompare = () => {
    if (triesUsed >= MAX_TRIES) {
      setStep('blocked');
    } else {
      setStep('leagues');
    }
  };

  // Switch ID resets everything
  const reset = () => {
    setStep('enter');
    setManager(null);
    setLeague(null);
    setRival(null);
    setTriesUsed(0);
    setShowLastTryWarning(false);
    setPendingRival(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: BG, color: INK }}>
      <TopBar manager={manager} step={step} onReset={reset} triesUsed={triesUsed} />

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px 64px' }}>
        {step === 'enter'   && <EnterStep onConnect={handleConnect} />}
        {step === 'leagues' && manager && (
          <LeaguesStep manager={manager} onPick={handlePickLeague} triesUsed={triesUsed} />
        )}
        {step === 'rivals'  && manager && league && (
          <RivalsStep
            manager={manager}
            league={league}
            triesUsed={triesUsed}
            onSelect={handleSelectRival}
            onBack={() => setStep('leagues')}
          />
        )}
        {step === 'compare' && rival && (
          <CompareStep
            manager={manager}
            rival={rival}
            mySquad={mySquad}   setMySquad={setMySquad}
            rivalSquad={rivalSquad} setRivalSquad={setRivalSquad}
            onBack={backFromCompare}
            triesUsed={triesUsed}
          />
        )}
      </main>

      {/* Last-try warning modal — appears over the rivals list */}
      {showLastTryWarning && pendingRival && (
        <LastTryWarning
          rival={pendingRival}
          onCancel={() => { setShowLastTryWarning(false); setPendingRival(null); }}
          onConfirm={() => proceedToCompare(pendingRival)}
        />
      )}

      {/* Hard upgrade block — non-dismissable */}
      {step === 'blocked' && <UpgradeBlock manager={manager} />}
    </div>
  );
}

// ─── Top bar with step progress + try counter ────────────────────────────────

function TopBar({ manager, step, onReset, triesUsed }) {
  const steps = [
    { id: 'enter',   label: 'Connect' },
    { id: 'leagues', label: 'League'  },
    { id: 'rivals',  label: 'Rival'   },
    { id: 'compare', label: 'Compare' },
  ];
  const activeIdx = Math.max(0, steps.findIndex(s => s.id === step));

  return (
    <header style={{
      background: CREAM,
      borderBottom: '1px solid rgba(60,45,68,0.08)',
      padding: '14px 24px',
      display: 'flex', alignItems: 'center', gap: 16,
      position: 'sticky', top: 0, zIndex: 200,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: `linear-gradient(135deg, ${INK}, ${PLUM})`,
          color: '#F3D9C3', fontFamily: "'Instrument Serif', serif",
          fontSize: 19, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>g</div>
        <div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, color: INK, lineHeight: 1, whiteSpace: 'nowrap' }}>
            FPL Ghost
          </div>
          <div style={{ fontSize: 9, color: MUTED, letterSpacing: 0.4, marginTop: 3, fontWeight: 600, whiteSpace: 'nowrap' }}>
            MVP · v0.1
          </div>
        </div>
      </div>

      {/* Step indicators */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {steps.map((s, i) => (
            <React.Fragment key={s.id}>
              {i > 0 && (
                <div style={{
                  width: 30, height: 1,
                  background: i <= activeIdx ? PLUM : 'rgba(60,45,68,0.18)',
                }} />
              )}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                color: i <= activeIdx ? INK : MUTED,
                fontWeight: i === activeIdx ? 600 : 500, fontSize: 12,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: i < activeIdx ? PLUM : (i === activeIdx ? INK : 'rgba(60,45,68,0.08)'),
                  color: i <= activeIdx ? '#fff' : MUTED,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                }}>
                  {i < activeIdx ? '✓' : i + 1}
                </div>
                {s.label}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right side: tries pill + manager info + switch */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        {manager && (
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
            padding: '4px 10px', borderRadius: 12, whiteSpace: 'nowrap',
            background: triesUsed >= MAX_TRIES ? 'rgba(184,90,78,0.12)' : 'rgba(107,53,83,0.08)',
            color: triesUsed >= MAX_TRIES ? RUST : PLUM,
          }}>
            TRIES · {triesUsed} / {MAX_TRIES}
          </div>
        )}
        {manager && (
          <div style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap' }}>
            <span style={{ color: INK, fontWeight: 600 }}>{manager.team}</span>
            <span style={{ margin: '0 6px' }}>·</span>
            ID {manager.id}
          </div>
        )}
        {manager && (
          <button onClick={onReset} style={{
            padding: '6px 10px', fontSize: 11,
            background: 'transparent', border: '1px solid rgba(60,45,68,0.15)',
            borderRadius: 6, color: MUTED, cursor: 'pointer',
          }}>Switch ID</button>
        )}
      </div>
    </header>
  );
}

// ─── STEP 1 — Enter Team ID (real API) ───────────────────────────────────────

function EnterStep({ onConnect }) {
  const [val, setVal]         = React.useState('');
  const [err, setErr]         = React.useState('');
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
      onConnect(await res.json());
    } catch (_) {
      setErr('Network error — is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade" style={{ maxWidth: 560, margin: '80px auto 0', textAlign: 'center' }}>
      <div style={{
        fontFamily: "'Instrument Serif', serif", fontSize: 54, color: INK,
        letterSpacing: -1.2, lineHeight: 1.05,
      }}>Enter your FPL Team ID</div>
      <div style={{ fontSize: 14, color: MUTED, marginTop: 14, lineHeight: 1.6 }}>
        7-digit number. Find it in the FPL app → "Points" tab, in the URL after
        <span style={{ color: INK, fontFamily: 'monospace', fontSize: 12, margin: '0 3px' }}>/entry/</span>.
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
            fontSize: 42, letterSpacing: 6, textAlign: 'center',
            padding: '10px 12px', background: 'transparent',
            border: `1.5px solid ${err ? RUST : 'rgba(60,45,68,0.15)'}`,
            borderRadius: 10, color: INK, outline: 'none', transition: 'border-color 0.2s',
          }}
        />
        <div style={{ marginTop: 10, fontSize: 11, color: err ? RUST : MUTED, minHeight: 16 }}>
          {err || `${val.length}/7 digits`}
        </div>
        <button
          onClick={tryConnect}
          disabled={!valid || loading}
          style={{
            marginTop: 12, width: '100%', padding: '13px',
            background: valid && !loading ? INK : 'rgba(60,45,68,0.15)',
            color: valid && !loading ? '#fff' : MUTED,
            border: 'none', borderRadius: 10,
            fontSize: 13, fontWeight: 600, letterSpacing: 0.3,
            cursor: valid && !loading ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
          }}
        >
          {loading ? 'Connecting…' : 'Connect squad →'}
        </button>
      </div>

      <div style={{ marginTop: 20, fontSize: 11, color: MUTED }}>
        Demo: try&nbsp;
        <button onClick={() => setVal('9364099')} style={{
          background: 'rgba(107,53,83,0.08)', border: 'none',
          padding: '3px 8px', borderRadius: 4, color: PLUM,
          fontFamily: 'monospace', fontSize: 11, cursor: 'pointer',
        }}>9364099</button>
      </div>
      <div style={{ marginTop: 28, fontSize: 11, color: MUTED, fontStyle: 'italic' }}>
        Free MVP includes 2 rival benchmarks per session.
      </div>
    </div>
  );
}

// ─── STEP 2 — Pick a League ───────────────────────────────────────────────────

function LeaguesStep({ manager, onPick, triesUsed }) {
  const remaining = MAX_TRIES - triesUsed;
  const leagues   = manager.leagues || [];

  return (
    <div className="fade">
      <StepHeader
        kicker="Step 2 of 4"
        title="Pick a league"
        sub={`${leagues.length} leagues connected to ${manager.team}. Tap any to benchmark against.`}
      />

      {triesUsed > 0 && (
        <div style={{
          marginTop: 16, padding: '10px 14px',
          background: 'rgba(107,53,83,0.06)',
          border: '1px solid rgba(107,53,83,0.18)',
          borderRadius: 8, fontSize: 12, color: PLUM, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>•</span>
          You have <strong>&nbsp;{remaining} {remaining === 1 ? 'try' : 'tries'}&nbsp;</strong> remaining in this session.
          Pick another league or switch back to a previous one.
        </div>
      )}

      <div style={{
        marginTop: 24,
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
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(107,53,83,0.35)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(60,45,68,0.08)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ fontSize: 9, color: MUTED, letterSpacing: 0.6, fontWeight: 700 }}>
                {(lg.type || 'Invitational').toUpperCase()}
                {lg.size > 0 && (
                  <span style={{ marginLeft: 8, fontWeight: 400 }}>
                    {lg.size.toLocaleString()} managers
                  </span>
                )}
              </div>
              <div style={{
                fontFamily: "'Instrument Serif', serif", fontSize: 26, color: INK,
                marginTop: 2, lineHeight: 1.1, letterSpacing: -0.3,
              }}>{lg.name}</div>
              <div style={{ marginTop: 12, display: 'flex', gap: 20, alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: 9, color: MUTED, letterSpacing: 0.4, fontWeight: 600 }}>YOUR RANK</div>
                  <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: INK, lineHeight: 1 }}>
                    {(lg.my_rank || 0).toLocaleString()}
                    {lg.size > 0 && <span style={{ fontSize: 11, color: MUTED, marginLeft: 3 }}>/ {lg.size.toLocaleString()}</span>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: MUTED, letterSpacing: 0.4, fontWeight: 600 }}>MOVEMENT</div>
                  <div style={{
                    fontSize: 13, fontWeight: 600, lineHeight: 1, marginTop: 4,
                    color: move > 0 ? SAGE : (move < 0 ? RUST : MUTED),
                  }}>
                    {move > 0 ? '↑' : move < 0 ? '↓' : '—'} {move !== 0 ? Math.abs(move).toLocaleString() : 'held'}
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

// ─── STEP 3 — Pick ONE rival (real API) ──────────────────────────────────────

function RivalsStep({ manager, league, triesUsed, onSelect, onBack }) {
  const [rivals, setRivals]     = React.useState([]);
  const [loading, setLoading]   = React.useState(true);
  const [fetchErr, setFetchErr] = React.useState('');
  const remaining = MAX_TRIES - triesUsed;

  React.useEffect(() => {
    if (!league?.fpl_id) return;
    setLoading(true);
    fetch(`/api/league/${league.fpl_id}/rivals?me=${manager.id}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setRivals(data); setLoading(false); })
      .catch(e  => { setFetchErr(String(e)); setLoading(false); });
  }, [league?.fpl_id, manager.id]);

  return (
    <div className="fade">
      <StepHeader
        kicker="Step 3 of 4"
        title={`Pick a rival in ${league?.name || 'this league'}`}
        sub="Tap any row to benchmark against them. One rival per try — your full Compare view opens immediately."
        backLabel="Leagues"
        onBack={onBack}
      />

      {/* Try counter banner */}
      <div style={{
        marginTop: 18, marginBottom: 16,
        padding: '10px 14px', borderRadius: 8,
        background: remaining === 1 ? 'rgba(184,90,78,0.08)' : 'rgba(107,53,83,0.06)',
        border: `1px solid ${remaining === 1 ? 'rgba(184,90,78,0.25)' : 'rgba(107,53,83,0.18)'}`,
        fontSize: 12, color: remaining === 1 ? RUST : PLUM, fontWeight: 500,
      }}>
        {remaining === MAX_TRIES
          ? <>You have <strong>{MAX_TRIES} tries</strong> this session — pick wisely.</>
          : <>⚠ <strong>Last try remaining.</strong> After this rival, you'll need to upgrade to keep benchmarking.</>
        }
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: MUTED }}>Loading league standings…</div>
      ) : fetchErr ? (
        <div style={{ padding: 24, textAlign: 'center', color: RUST, fontSize: 13 }}>
          Couldn't load standings: {fetchErr}
        </div>
      ) : rivals.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>
          No standings found for this league.
        </div>
      ) : (
        <div style={{
          background: CREAM, border: '1px solid rgba(60,45,68,0.08)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '56px 1fr 110px 90px 90px 90px',
            padding: '10px 16px',
            fontSize: 9, color: MUTED, letterSpacing: 0.5, fontWeight: 700,
            borderBottom: '1px solid rgba(60,45,68,0.08)',
            background: 'rgba(60,45,68,0.02)',
          }}>
            <div>RANK</div>
            <div>MANAGER · TEAM</div>
            <div style={{ textAlign: 'right' }}>TOTAL</div>
            <div style={{ textAlign: 'right' }}>GW</div>
            <div style={{ textAlign: 'center' }}>MOVE</div>
            <div />
          </div>

          {/* Rival rows — tap to compare immediately */}
          {rivals.map(r => (
            <div
              key={r.id}
              onClick={() => !r.isMe && onSelect(r)}
              style={{
                display: 'grid', gridTemplateColumns: '56px 1fr 110px 90px 90px 90px',
                padding: '14px 16px', alignItems: 'center',
                borderBottom: '1px solid rgba(60,45,68,0.06)',
                background: r.isMe ? 'rgba(107,53,83,0.05)' : 'transparent',
                cursor: r.isMe ? 'default' : 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!r.isMe) e.currentTarget.style.background = 'rgba(201,122,84,0.08)'; }}
              onMouseLeave={e => { if (!r.isMe) e.currentTarget.style.background = r.isMe ? 'rgba(107,53,83,0.05)' : 'transparent'; }}
            >
              <div style={{
                fontFamily: "'Instrument Serif', serif", fontSize: 20,
                color: r.isMe ? PLUM : INK,
              }}>
                {(r.rank || 0).toLocaleString()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                  {r.manager}
                  {r.isMe && <span style={{ color: MUTED, fontWeight: 400, marginLeft: 6 }}>(you)</span>}
                </div>
                <div style={{ fontSize: 11, color: MUTED }}>{r.team}</div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: "'Instrument Serif', serif", fontSize: 18, color: INK }}>
                {(r.total || 0).toLocaleString()}
              </div>
              <div style={{
                textAlign: 'right', fontSize: 13, fontWeight: 600,
                color: r.gw >= 60 ? SAGE : INK,
              }}>
                {r.gw || 0}
              </div>
              <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600 }}>
                {r.delta > 0 && <span style={{ color: SAGE }}>↑ {r.delta}</span>}
                {r.delta < 0 && <span style={{ color: RUST }}>↓ {Math.abs(r.delta)}</span>}
                {(!r.delta || r.delta === 0) && <span style={{ color: MUTED }}>—</span>}
              </div>
              <div style={{ textAlign: 'right' }}>
                {!r.isMe && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: PLUM }}>Compare →</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── STEP 4 — Compare (full original CompareView) ────────────────────────────

function CompareStep({ manager, rival, mySquad, setMySquad, rivalSquad, setRivalSquad, onBack, triesUsed }) {
  const CV = window.CompareView;

  return (
    <div className="fade">
      {/* Header strip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, marginBottom: 8, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 10, color: MUTED, letterSpacing: 0.7, fontWeight: 700 }}>
            STEP 4 OF 4 · TRY {triesUsed} OF {MAX_TRIES}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 4 }}>
            <h1 style={{
              fontFamily: "'Instrument Serif', serif", fontSize: 42, color: INK,
              margin: 0, letterSpacing: -0.8, lineHeight: 1.1, fontWeight: 400,
            }}>
              {manager?.team} <span style={{ color: MUTED }}>vs</span> {rival?.team || rival?.manager}
            </h1>
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>
            Live head-to-head with win probability, differentials, and the transfer simulator.
          </div>
        </div>
        <button onClick={onBack} style={{
          padding: '8px 14px', fontSize: 12, fontWeight: 600,
          background: 'transparent', border: '1px solid rgba(60,45,68,0.15)',
          borderRadius: 8, color: INK, cursor: 'pointer', flexShrink: 0,
        }}>← Back to leagues</button>
      </div>

      {/* Full compare view */}
      {CV ? (
        <CV
          mySquad={mySquad}       setMySquad={setMySquad}
          rivalSquad={rivalSquad} setRivalSquad={setRivalSquad}
          jerseyStyle={window.__TWEAKS?.jerseyStyle || 'textured'}
        />
      ) : (
        <div style={{ padding: 48, textAlign: 'center', color: MUTED }}>
          Compare view not available — ensure compare.jsx is loaded.
        </div>
      )}
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function LastTryWarning({ rival, onCancel, onConfirm }) {
  return (
    <Backdrop>
      <div style={{
        background: CREAM, borderRadius: 16, padding: 28, maxWidth: 440,
        border: `2px solid ${CORAL}`,
        boxShadow: '0 24px 60px -10px rgba(60,45,68,0.4)',
      }}>
        <div style={{
          display: 'inline-block', padding: '4px 10px', borderRadius: 12,
          background: 'rgba(184,90,78,0.12)', color: RUST,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
        }}>⚠ LAST TRY</div>
        <h2 style={{
          fontFamily: "'Instrument Serif', serif", fontSize: 32, color: INK,
          margin: '14px 0 8px', lineHeight: 1.1, letterSpacing: -0.5, fontWeight: 400,
        }}>This is your final benchmark of the session.</h2>
        <p style={{ fontSize: 13, color: '#6b5a72', lineHeight: 1.5, margin: '0 0 10px' }}>
          You're about to compare against&nbsp;
          <strong style={{ color: INK }}>{rival.manager}</strong> ({rival.team}).
          After this, you'll need to upgrade to benchmark anyone else this session.
        </p>
        <p style={{ fontSize: 12, color: MUTED, margin: '0 0 20px' }}>
          Sure they're the right rival to study?
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '10px 16px', fontSize: 13, fontWeight: 600,
            background: 'transparent', border: '1px solid rgba(60,45,68,0.18)',
            borderRadius: 8, color: INK, cursor: 'pointer',
          }}>Pick someone else</button>
          <button onClick={onConfirm} style={{
            padding: '10px 16px', fontSize: 13, fontWeight: 600,
            background: INK, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
          }}>Use last try →</button>
        </div>
      </div>
    </Backdrop>
  );
}

function UpgradeBlock() {
  return (
    <Backdrop opaque>
      <div style={{
        background: CREAM, borderRadius: 18, padding: 36, maxWidth: 520,
        border: '1px solid rgba(60,45,68,0.08)',
        boxShadow: '0 30px 80px -10px rgba(60,45,68,0.5)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, margin: '0 auto 18px',
          background: `linear-gradient(135deg, ${PLUM}, ${CORAL})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#F3D9C3', fontFamily: "'Instrument Serif', serif", fontSize: 28,
        }}>★</div>

        <div style={{ fontSize: 10, color: PLUM, letterSpacing: 0.7, fontWeight: 700 }}>
          FREE TIER LIMIT REACHED
        </div>
        <h2 style={{
          fontFamily: "'Instrument Serif', serif", fontSize: 38, color: INK,
          margin: '8px 0 12px', lineHeight: 1.05, letterSpacing: -0.8, fontWeight: 400,
        }}>You've used your 2 free benchmarks.</h2>
        <p style={{ fontSize: 14, color: '#6b5a72', lineHeight: 1.6, margin: '0 0 24px' }}>
          Upgrade to <strong style={{ color: INK }}>Ghost Pro</strong> to benchmark unlimited rivals,
          across all your leagues, with live transfer recommendations and the full simulator.
        </p>

        <div style={{
          padding: 16, borderRadius: 12,
          background: 'rgba(107,53,83,0.06)',
          border: '1px solid rgba(107,53,83,0.15)',
          textAlign: 'left', marginBottom: 22,
        }}>
          {[
            'Unlimited rival comparisons across all leagues',
            'Live transfer recommendations with EV scoring',
            'Player flags: injuries, BGW, DGW, suspensions',
            'GW planner with chip strategy',
          ].map(f => (
            <div key={f} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              marginBottom: 6, fontSize: 13, color: '#3a2d44',
            }}>
              <span style={{ color: SAGE, fontWeight: 700 }}>✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>

        <button style={{
          width: '100%', padding: '14px', fontSize: 14, fontWeight: 700,
          background: INK, color: '#fff', border: 'none', borderRadius: 10,
          cursor: 'pointer', letterSpacing: 0.3,
          boxShadow: '0 6px 20px -4px rgba(42,26,48,0.4)',
        }}>
          Upgrade to Ghost Pro · £4/mo →
        </button>
        <div style={{ marginTop: 12, fontSize: 11, color: MUTED }}>
          Cancel anytime · 7-day free trial
        </div>
      </div>
    </Backdrop>
  );
}

function Backdrop({ children, opaque }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: opaque ? 'rgba(42,26,48,0.85)' : 'rgba(42,26,48,0.55)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'fadeInUp 0.25s ease both',
    }}>
      {children}
    </div>
  );
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function StepHeader({ kicker, title, sub, backLabel, onBack }) {
  return (
    <div>
      {kicker && (
        <div style={{ fontSize: 10, color: MUTED, letterSpacing: 0.7, fontWeight: 700 }}>
          {kicker}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
        <h1 style={{
          fontFamily: "'Instrument Serif', serif", fontSize: 42, color: INK,
          margin: 0, letterSpacing: -0.8, lineHeight: 1.1, fontWeight: 400,
        }}>{title}</h1>
        {onBack && (
          <button onClick={onBack} style={{
            background: 'transparent', border: '1px solid rgba(60,45,68,0.15)',
            padding: '5px 10px', borderRadius: 6, fontSize: 11, color: MUTED,
            cursor: 'pointer',
          }}>← {backLabel}</button>
        )}
      </div>
      {sub && (
        <div style={{ fontSize: 13, color: MUTED, marginTop: 6, maxWidth: 720, lineHeight: 1.5 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// Mount — MvpApp takes the root (app.jsx is NOT loaded in FPL Ghost MVP.html)
ReactDOM.createRoot(document.getElementById('root')).render(<MvpApp />);
