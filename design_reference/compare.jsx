// Compare view — side-by-side pitches + win probability + player-by-player diff

// Returns a version of squad with proj/captain adjusted for a given GW and optimal lineup
function _squadForGw(squad, gw, optimal) {
  if (!gw || !optimal) return squad;
  const xiIds   = new Set(optimal.xiIds || []);
  const capId   = optimal.captainId;
  const viceId  = optimal.viceId;
  return squad.map(p => {
    const gwEntry = (p.xpByGw || []).find(g => g.gw === gw);
    return {
      ...p,
      proj:    gwEntry ? gwEntry.xp : p.proj,
      captain: p.id === capId,
      vice:    p.id === viceId,
      _inXi:   xiIds.size ? xiIds.has(p.id) : p.startIdx < 11,
    };
  }).sort((a, b) => {
    // Keep bench at back
    if (a._inXi !== b._inXi) return a._inXi ? -1 : 1;
    return a.startIdx - b.startIdx;
  });
}

function CompareView({ mySquad, rivalSquad, setMySquad, setRivalSquad, jerseyStyle }) {
  const nextGw     = window.FPL_STATE?.nextGw || 1;
  const optimalMap = window.FPL_STATE?.optimalByGw || {};
  const gws        = Object.keys(optimalMap).map(Number).sort((a,b)=>a-b);
  // Fall back to next 5 GWs if optimizer didn't run
  const gwList     = gws.length ? gws : Array.from({length:5}, (_,i) => nextGw + i);

  const [selectedGw, setSelectedGw] = React.useState(gwList[0] || nextGw);

  const optimal    = optimalMap[selectedGw];
  const mySquadGw  = _squadForGw(mySquad, selectedGw, optimal);
  // Rival uses raw xpByGw (no optimizer — we don't know their squad strategy)
  const rivalSquadGw = _squadForGw(rivalSquad, selectedGw, null);

  const myProj    = calculateProjectionGw(mySquadGw, selectedGw, optimal);
  const rivalProj = calculateProjectionGw(rivalSquadGw, selectedGw, null);
  const delta     = myProj - rivalProj;
  const winProb   = calculateWinProb(myProj, rivalProj, 15.2, 16.8);

  const shared = [], myOnly = [], rivalOnly = [];
  mySquadGw.slice(0, 11).forEach(p => {
    const inRival = rivalSquadGw.slice(0, 11).find(r => r.id === p.id);
    if (inRival) shared.push(p); else myOnly.push(p);
  });
  rivalSquadGw.slice(0, 11).forEach(r => {
    if (!mySquadGw.slice(0, 11).find(p => p.id === r.id)) rivalOnly.push(r);
  });

  return (
    <div style={{ padding: '20px 24px 40px' }}>
      {/* GW Selector tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {gwList.map(gw => {
          const opt = optimalMap[gw];
          const active = gw === selectedGw;
          return (
            <button
              key={gw}
              onClick={() => setSelectedGw(gw)}
              style={{
                padding: '8px 18px',
                borderRadius: 20,
                border: active ? 'none' : '1px solid rgba(60,45,68,0.15)',
                background: active ? '#6b3553' : '#FDFAF4',
                color: active ? '#fff' : '#6b5a72',
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                transition: 'all 0.15s',
              }}
            >
              <span>GW{gw}</span>
              {opt && (
                <span style={{ fontSize: 10, opacity: 0.8 }}>{opt.totalXp.toFixed(0)} xP</span>
              )}
            </button>
          );
        })}
        {optimal && (
          <div style={{
            marginLeft: 'auto', alignSelf: 'center',
            fontSize: 12, color: '#6b5a72',
            background: 'rgba(107,53,83,0.08)',
            borderRadius: 8, padding: '6px 12px',
          }}>
            ⚡ Auto: <strong>{optimal.captainName}</strong> captains
          </div>
        )}
      </div>
      {/* Header — Win probability hero */}
      <WinProbabilityHero
        myProj={myProj}
        rivalProj={rivalProj}
        delta={delta}
        winProb={winProb}
        gw={selectedGw}
      />

      {/* Live transfer simulator */}
      <window.CompareSimulator
        mySquad={mySquadGw}
        setMySquad={setMySquad}
        rivalSquad={rivalSquadGw}
        jerseyStyle={jerseyStyle}
      />

      {/* Status alert if flags present */}
      <div style={{ marginTop: 16 }}>
        <window.StatusAlertBanner squad={mySquadGw} />
      </div>

      {/* Two pitches side-by-side */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 20,
        marginTop: 24,
      }}>
        <div style={{
          background: '#FDFAF4',
          borderRadius: 16,
          border: '1px solid rgba(60, 45, 68, 0.08)',
          padding: '0 0 16px',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(60, 45, 68, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#6b3553', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                flexShrink: 0,
              }}>TM</div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: '#2a2230',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{window.MY_SQUAD?.[0] ? (window.FPL_STATE?.managerName || 'Your team') : 'Ghost Protocol'}</div>
                <div style={{
                  fontSize: 11, color: '#8a7a90', marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{window.FPL_STATE?.managerName || 'Theo Martens'} · you</div>
              </div>
            </div>
            <div style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: 32,
              color: '#3a2d44',
              lineHeight: 1,
              flexShrink: 0,
            }}>{myProj.toFixed(1)}<span style={{ fontSize: 14, color: '#8a7a90', marginLeft: 6 }}>pts</span></div>
          </div>
          <PitchView squad={mySquadGw} setSquad={setMySquad} jerseyStyle={jerseyStyle} compact showSubtitle={false} />
        </div>
        <div style={{
          background: '#FDFAF4',
          borderRadius: 16,
          border: '1px solid rgba(60, 45, 68, 0.08)',
          padding: '0 0 16px',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(60, 45, 68, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#c97a54', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                flexShrink: 0,
              }}>DP</div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: '#2a2230',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{(() => { const r = window.MINI_LEAGUE?.find(e => e.id === 'rival'); return r?.team || 'Rival team'; })()}</div>
                <div style={{
                  fontSize: 11, color: '#8a7a90', marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{(() => { const r = window.MINI_LEAGUE?.find(e => e.id === 'rival'); return r?.manager || 'Danny Park'; })()} · rival</div>
              </div>
            </div>
            <div style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: 32,
              color: '#3a2d44',
              lineHeight: 1,
            }}>{rivalProj.toFixed(1)}<span style={{ fontSize: 14, color: '#8a7a90', marginLeft: 6 }}>pts</span></div>
          </div>
          <PitchView squad={rivalSquadGw} setSquad={setRivalSquad} jerseyStyle={jerseyStyle} compact showSubtitle={false} interactive={false} />
        </div>
      </div>

      {/* Player diff table */}
      <div style={{ marginTop: 28 }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <h3 style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 26,
            fontWeight: 400,
            color: '#3a2d44',
            margin: 0,
          }}>Player differentials</h3>
          <div style={{ fontSize: 12, color: '#8a7a90' }}>
            {shared.length} shared · {myOnly.length} unique to you · {rivalOnly.length} unique to rival
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
        }}>
          <DiffColumn
            title="Only in your XI"
            players={myOnly}
            accent="#6b3553"
            arrow="▲"
          />
          <DiffColumn
            title="Only in rival's XI"
            players={rivalOnly}
            accent="#c97a54"
            arrow="▼"
          />
        </div>
      </div>

      {/* GW accuracy backtest */}
      <AccuracyPanel />

      {/* Model calibration panel */}
      <CalibrationPanel />

      {/* 5-GW Horizon */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 26, fontWeight: 400, color: '#3a2d44', margin: '0 0 14px',
        }}>5-gameweek outlook</h3>
        <GwHorizonChart mySquad={mySquad} rivalSquad={rivalSquad} selectedGw={selectedGw} optimalMap={optimalMap} />
      </div>

      {/* Projection distributions */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 26,
          fontWeight: 400,
          color: '#3a2d44',
          margin: '0 0 14px',
        }}>Projected points distribution</h3>
        <DistributionChart
          myMean={myProj}
          rivalMean={rivalProj}
          myStddev={15.2}
          rivalStddev={16.8}
        />
      </div>
    </div>
  );
}

function WinProbabilityHero({ myProj, rivalProj, delta, winProb, gw }) {
  const positive = delta >= 0;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
      gap: 1,
      background: 'rgba(60, 45, 68, 0.08)',
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid rgba(60, 45, 68, 0.08)',
    }}>
      <StatCell
        label={gw ? `GW${gw} win probability` : 'Win probability'}
        value={`${(winProb * 100).toFixed(1)}%`}
        big
        accent
        sub={winProb > 0.5 ? 'You\'re favoured' : 'Rival favoured'}
      />
      <StatCell
        label="Projected delta"
        value={`${positive ? '+' : ''}${delta.toFixed(1)}`}
        valueColor={positive ? '#4a7a4a' : '#b85a4e'}
        sub="points this GW"
      />
      <StatCell
        label="Your mean"
        value={myProj.toFixed(1)}
        sub="σ 15.2 pts"
      />
      <StatCell
        label="Rival mean"
        value={rivalProj.toFixed(1)}
        sub="σ 16.8 pts"
      />
    </div>
  );
}

function StatCell({ label, value, sub, big, accent, valueColor }) {
  return (
    <div style={{
      background: accent ? 'linear-gradient(135deg, #F3D9C3 0%, #EAC3A7 100%)' : '#FDFAF4',
      padding: big ? '22px 24px' : '18px 22px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <div style={{
        fontSize: 11,
        color: '#7a6278',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        fontWeight: 500,
      }}>{label}</div>
      <div style={{
        fontFamily: "'Instrument Serif', serif",
        fontSize: big ? 52 : 40,
        fontWeight: 400,
        color: valueColor || '#2a1a30',
        lineHeight: 1,
        marginTop: 6,
        letterSpacing: -1,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#8a7a90', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function DiffColumn({ title, players, accent, arrow }) {
  return (
    <div style={{
      background: '#FDFAF4',
      border: '1px solid rgba(60, 45, 68, 0.08)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(60, 45, 68, 0.08)',
        fontSize: 12,
        color: '#6b5a72',
        fontWeight: 600,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
      }}>{title}</div>
      {players.length === 0 && (
        <div style={{ padding: 20, color: '#9b8aa1', fontSize: 13, fontStyle: 'italic' }}>
          No differentials
        </div>
      )}
      {players.map(p => (
        <div key={p.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          borderBottom: '1px solid rgba(60, 45, 68, 0.04)',
        }}>
          <div style={{ width: 32 }}>
            <window.Jersey club={p.club} style="minimal" size={32} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2230' }}>{p.name}</div>
            <div style={{ fontSize: 11, color: '#8a7a90' }}>
              {window.TEAMS[p.club]?.short} · £{p.price.toFixed(1)}m
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: 20,
              color: accent,
              lineHeight: 1,
            }}>{p.proj.toFixed(1)}</div>
            <div style={{ fontSize: 10, color: '#9b8aa1', marginTop: 2 }}>proj pts</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DistributionChart({ myMean, rivalMean, myStddev, rivalStddev }) {
  const w = 720;
  const h = 220;
  const pad = { l: 40, r: 140, t: 20, b: 32 };

  const gaussian = (x, mean, std) =>
    Math.exp(-0.5 * Math.pow((x - mean) / std, 2)) / (std * Math.sqrt(2 * Math.PI));

  const maxY = Math.max(
    gaussian(myMean, myMean, myStddev),
    gaussian(rivalMean, rivalMean, rivalStddev)
  );

  const pointsPath = (mean, std) => {
    let d = '';
    for (let x = 0; x <= 150; x += 1) {
      const px = pad.l + (x / 150) * (w - pad.l - pad.r);
      const py = h - pad.b - (gaussian(x, mean, std) / maxY) * (h - pad.t - pad.b);
      d += (x === 0 ? 'M' : 'L') + px + ',' + py + ' ';
    }
    return d;
  };

  const myArea = pointsPath(myMean, myStddev) + ` L ${w - pad.r} ${h - pad.b} L ${pad.l} ${h - pad.b} Z`;
  const rivalArea = pointsPath(rivalMean, rivalStddev) + ` L ${w - pad.r} ${h - pad.b} L ${pad.l} ${h - pad.b} Z`;

  // Probability Y > rival's mean given my distribution
  const pctAbove = (mean, std, threshold) => {
    // z-score
    const z = (threshold - mean) / std;
    // approx erf
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804 * Math.exp(-0.5 * z * z);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? p : 1 - p;
  };

  return (
    <div style={{
      background: '#FDFAF4',
      border: '1px solid rgba(60, 45, 68, 0.08)',
      borderRadius: 12,
      padding: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 20,
    }}>
      <svg width={w} height={h} style={{ flex: 1, maxWidth: '100%' }}>
        <defs>
          <linearGradient id="my-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6b3553" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6b3553" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="rival-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c97a54" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#c97a54" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 40, 60, 80, 120].map(tick => {
          const x = pad.l + (tick / 150) * (w - pad.l - pad.r);
          return (
            <g key={tick}>
              <line x1={x} y1={pad.t} x2={x} y2={h - pad.b} stroke="rgba(60,45,68,0.08)" strokeDasharray="2 3" />
              <text x={x} y={h - pad.b + 16} fontSize="10" textAnchor="middle" fill="#9b8aa1" fontFamily="Inter, sans-serif">{tick}</text>
            </g>
          );
        })}

        {/* Rival curve */}
        <path d={rivalArea} fill="url(#rival-fill)" />
        <path d={pointsPath(rivalMean, rivalStddev)} fill="none" stroke="#c97a54" strokeWidth="1.8" />

        {/* My curve */}
        <path d={myArea} fill="url(#my-fill)" />
        <path d={pointsPath(myMean, myStddev)} fill="none" stroke="#6b3553" strokeWidth="2" />

        {/* Mean markers */}
        <line x1={pad.l + (myMean / 150) * (w - pad.l - pad.r)} y1={pad.t + 10} x2={pad.l + (myMean / 150) * (w - pad.l - pad.r)} y2={h - pad.b} stroke="#6b3553" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={pad.l + (rivalMean / 150) * (w - pad.l - pad.r)} y1={pad.t + 10} x2={pad.l + (rivalMean / 150) * (w - pad.l - pad.r)} y2={h - pad.b} stroke="#c97a54" strokeWidth="1" strokeDasharray="3 3" />

        <text x={pad.l - 6} y={h - pad.b + 16} fontSize="10" textAnchor="end" fill="#9b8aa1" fontFamily="Inter, sans-serif">pts →</text>
      </svg>

      <div style={{ width: 180, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
        <LegendRow color="#6b3553" label="You" mean={myMean} stddev={myStddev} />
        <LegendRow color="#c97a54" label="Rival" mean={rivalMean} stddev={rivalStddev} />
        <div style={{ height: 1, background: 'rgba(60,45,68,0.1)', margin: '8px 0' }} />
        <Pctile label="40+ pts" value={(1 - pctAbove(myMean, myStddev, 40)) * 100} />
        <Pctile label="60+ pts" value={(1 - pctAbove(myMean, myStddev, 60)) * 100} />
        <Pctile label="80+ pts" value={(1 - pctAbove(myMean, myStddev, 80)) * 100} />
      </div>
    </div>
  );
}

function LegendRow({ color, label, mean, stddev }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
      <div style={{ flex: 1, fontSize: 12, color: '#6b5a72', fontWeight: 500 }}>{label}</div>
      <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, color: '#2a2230' }}>{mean.toFixed(1)}</div>
    </div>
  );
}

function Pctile({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
      <span style={{ color: '#8a7a90' }}>{label}</span>
      <span style={{ color: '#2a2230', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function GwHorizonChart({ mySquad, rivalSquad, selectedGw, optimalMap }) {
  const gws = (mySquad[0]?.xpByGw || []).map(g => g.gw);
  if (!gws.length) return null;

  const myGwTotals = gws.map(gw => {
    const opt   = optimalMap?.[gw];
    const squad = _squadForGw(mySquad, gw, opt);
    return squad.slice(0, 11).reduce((sum, p) => {
      const entry = (p.xpByGw || []).find(g => g.gw === gw);
      const xp = entry ? entry.xp : 0;
      return sum + (p.captain ? xp * 2 : xp);
    }, 0);
  });
  const rivalGwTotals = gws.map(gw => {
    return rivalSquad.slice(0, 11).reduce((sum, p) => {
      const entry = (p.xpByGw || []).find(g => g.gw === gw);
      const xp = entry ? entry.xp : 0;
      return sum + (p.captain ? xp * 2 : xp);
    }, 0);
  });

  const maxVal = Math.max(...myGwTotals, ...rivalGwTotals, 1);
  const myTotal = myGwTotals.reduce((a, b) => a + b, 0);
  const rivTotal = rivalGwTotals.reduce((a, b) => a + b, 0);

  return (
    <div style={{
      background: '#FDFAF4',
      border: '1px solid rgba(60,45,68,0.08)',
      borderRadius: 12, padding: 20,
    }}>
      {/* Summary row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#6b3553' }} />
          <span style={{ fontSize: 12, color: '#6b5a72', fontWeight: 500 }}>You</span>
          <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: '#3a2d44', marginLeft: 6 }}>{myTotal.toFixed(1)}</span>
          <span style={{ fontSize: 11, color: '#9b8aa1' }}>pts over 5 GWs</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: myTotal >= rivTotal ? '#4a7a4a' : '#b85a4e' }}>
          {myTotal >= rivTotal ? '+' : ''}{(myTotal - rivTotal).toFixed(1)} pts
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#9b8aa1' }}>pts over 5 GWs</span>
          <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: '#3a2d44' }}>{rivTotal.toFixed(1)}</span>
          <span style={{ fontSize: 12, color: '#6b5a72', fontWeight: 500 }}>Rival</span>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#c97a54' }} />
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 110 }}>
        {gws.map((gw, i) => {
          const myH = Math.max(4, (myGwTotals[i] / maxVal) * 90);
          const rivH = Math.max(4, (rivalGwTotals[i] / maxVal) * 90);
          const myWins = myGwTotals[i] >= rivalGwTotals[i];
          const isSelected = gw === selectedGw;
          return (
            <div key={gw} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              background: isSelected ? 'rgba(107,53,83,0.06)' : 'transparent',
              borderRadius: 8, padding: '4px 2px 0',
            }}>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', width: '100%' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 9, color: '#6b3553', fontWeight: 600 }}>{myGwTotals[i].toFixed(0)}</span>
                  <div style={{ width: '100%', height: myH, background: myWins ? '#6b3553' : 'rgba(107,53,83,0.3)', borderRadius: '3px 3px 0 0' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 9, color: '#c97a54', fontWeight: 600 }}>{rivalGwTotals[i].toFixed(0)}</span>
                  <div style={{ width: '100%', height: rivH, background: !myWins ? '#c97a54' : 'rgba(201,122,84,0.3)', borderRadius: '3px 3px 0 0' }} />
                </div>
              </div>
              <div style={{ fontSize: 10, color: isSelected ? '#6b3553' : '#9b8aa1', fontWeight: isSelected ? 600 : 400, letterSpacing: 0.2, textAlign: 'center' }}>
                GW{gw}{myGwTotals[i] === 0 && rivalGwTotals[i] === 0 ? ' ✕' : ''}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: '#9b8aa1', textAlign: 'center' }}>
        ✕ = blank gameweek for all starters
      </div>
    </div>
  );
}

// --- helpers ---

// Original projection helper (uses current proj field)
function calculateProjection(squad) {
  return squad.slice(0, 11).reduce((sum, p) => sum + p.proj * (p.captain ? 2 : 1), 0);
}

// GW-aware projection: uses xpByGw for the selected GW
function calculateProjectionGw(squad, gw, optimal) {
  const xi = optimal ? squad.filter(p => (optimal.xiIds || []).includes(p.id)) : squad.slice(0, 11);
  return xi.reduce((sum, p) => {
    const entry = (p.xpByGw || []).find(g => g.gw === gw);
    const xp = entry ? entry.xp : p.proj;
    return sum + xp * (p.captain ? 2 : 1);
  }, 0);
}

function CalibrationPanel() {
  const cal = window.FPL_STATE?.calibration;
  if (!cal || !cal.length) return null;
  const mae = cal.reduce((s, r) => s + Math.abs(r.diff), 0) / cal.length;
  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <h3 style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 26, fontWeight: 400, color: '#3a2d44', margin: 0,
        }}>Model calibration</h3>
        <div style={{ fontSize: 12, color: '#8a7a90' }}>
          Our xP vs FPL's official estimate · your squad only · MAE {mae.toFixed(2)} pts
        </div>
      </div>
      <div style={{
        background: '#FDFAF4', border: '1px solid rgba(60,45,68,0.08)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
          padding: '8px 16px', borderBottom: '1px solid rgba(60,45,68,0.08)',
          fontSize: 11, color: '#7a6278', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase',
        }}>
          <span>Player</span>
          <span style={{ textAlign: 'right' }}>Our xP</span>
          <span style={{ textAlign: 'right' }}>FPL est.</span>
          <span style={{ textAlign: 'right' }}>Diff</span>
        </div>
        {cal.map((r, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
            padding: '9px 16px', borderBottom: '1px solid rgba(60,45,68,0.04)',
            background: i % 2 === 0 ? 'transparent' : 'rgba(60,45,68,0.015)',
            alignItems: 'center',
          }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#2a2230' }}>{r.name}</span>
              <span style={{ fontSize: 11, color: '#9b8aa1', marginLeft: 8 }}>{r.pos}</span>
            </div>
            <div style={{ textAlign: 'right', fontFamily: "'Instrument Serif', serif", fontSize: 16, color: '#2a2230' }}>
              {r.our_xp.toFixed(1)}
            </div>
            <div style={{ textAlign: 'right', fontFamily: "'Instrument Serif', serif", fontSize: 16, color: '#6b5a72' }}>
              {r.fpl_ep.toFixed(1)}
            </div>
            <div style={{
              textAlign: 'right', fontSize: 12, fontWeight: 600,
              color: r.diff > 0.5 ? '#4a7a4a' : r.diff < -0.5 ? '#b85a4e' : '#8a7a90',
            }}>
              {r.diff > 0 ? '+' : ''}{r.diff.toFixed(1)}
            </div>
          </div>
        ))}
        <div style={{ padding: '10px 16px', fontSize: 11, color: '#9b8aa1' }}>
          Positive diff = our model is more optimistic than FPL's estimate.
          FPL's estimate uses a proprietary model updated weekly.
        </div>
      </div>
    </div>
  );
}

function calculateWinProb(myMean, rivalMean, myStd, rivalStd) {
  // P(X - Y > 0) where X ~ N(myMean, myStd), Y ~ N(rivalMean, rivalStd)
  const diffMean = myMean - rivalMean;
  const diffStd = Math.sqrt(myStd * myStd + rivalStd * rivalStd);
  const z = diffMean / diffStd;
  // approx erf -> phi(z)
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804 * Math.exp(-0.5 * z * z);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function AccuracyPanel() {
  const rows = window.FPL_STATE?.gwAccuracy;
  const gw   = window.FPL_STATE?.backtestGw;
  if (!rows || !rows.length) return null;

  const played   = rows.filter(r => r.minutes > 0 || r.actual > 0);
  const mae      = played.length
    ? played.reduce((s, r) => s + Math.abs(r.error), 0) / played.length
    : 0;
  const rmse     = played.length
    ? Math.sqrt(played.reduce((s, r) => s + r.error * r.error, 0) / played.length)
    : 0;
  const overPreds  = played.filter(r => r.error > 1).length;
  const underPreds = played.filter(r => r.error < -1).length;
  const accurate   = played.length - overPreds - underPreds;

  const maxActual = Math.max(...rows.map(r => r.actual), 1);

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h3 style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 26, fontWeight: 400, color: '#3a2d44', margin: 0,
        }}>GW{gw} accuracy check</h3>
        <div style={{ fontSize: 12, color: '#8a7a90', flex: 1 }}>
          Predicted (using only pre-GW{gw} data) vs actual points scored · your squad
        </div>
      </div>

      {/* Summary stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1, background: 'rgba(60,45,68,0.08)',
        borderRadius: 12, overflow: 'hidden', marginBottom: 16,
        border: '1px solid rgba(60,45,68,0.08)',
      }}>
        {[
          { label: 'Mean abs. error', value: mae.toFixed(2) + ' pts', sub: 'lower = better' },
          { label: 'RMSE', value: rmse.toFixed(2) + ' pts', sub: 'penalises big misses' },
          { label: 'Over-predicted', value: overPreds, sub: `by >1 pt` },
          { label: 'Under-predicted', value: underPreds, sub: `by >1 pt` },
        ].map(s => (
          <div key={s.label} style={{ background: '#FDFAF4', padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: '#7a6278', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 30, color: '#2a1a30', lineHeight: 1.1, marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#9b8aa1', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Player rows */}
      <div style={{
        background: '#FDFAF4', border: '1px solid rgba(60,45,68,0.08)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 40px 90px 90px 80px',
          padding: '8px 16px',
          borderBottom: '1px solid rgba(60,45,68,0.08)',
          fontSize: 11, color: '#7a6278', fontWeight: 600,
          letterSpacing: 0.4, textTransform: 'uppercase',
        }}>
          <span>Player</span>
          <span style={{ textAlign: 'center' }}>Fix</span>
          <span style={{ textAlign: 'right' }}>Predicted</span>
          <span style={{ textAlign: 'right' }}>Actual</span>
          <span style={{ textAlign: 'right' }}>Error</span>
        </div>

        {rows.map((r, i) => {
          const errColor = Math.abs(r.error) <= 1 ? '#4a7a4a'
            : r.error > 0 ? '#b85a4e' : '#c97a54';
          const barPct = (r.actual / maxActual) * 100;
          return (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 40px 90px 90px 80px',
              padding: '9px 16px',
              borderBottom: '1px solid rgba(60,45,68,0.04)',
              background: i % 2 === 0 ? 'transparent' : 'rgba(60,45,68,0.015)',
              alignItems: 'center',
            }}>
              {/* Name + bar */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#2a2230' }}>{r.name}</span>
                  <span style={{ fontSize: 10, color: '#9b8aa1' }}>{r.pos} · {r.club}</span>
                  {r.dgw && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: '#6b3553',
                      background: 'rgba(107,53,83,0.1)', borderRadius: 4, padding: '1px 5px',
                    }}>DGW</span>
                  )}
                  {r.minutes === 0 && (
                    <span style={{
                      fontSize: 9, color: '#9b8aa1',
                      background: 'rgba(60,45,68,0.08)', borderRadius: 4, padding: '1px 5px',
                    }}>DNP</span>
                  )}
                </div>
                {/* Actual score bar */}
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(60,45,68,0.08)', width: '80%' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${barPct}%`,
                    background: r.actual >= 10 ? '#4a7a4a' : r.actual >= 6 ? '#6b3553' : 'rgba(107,53,83,0.4)',
                  }} />
                </div>
              </div>

              {/* Fixtures count */}
              <div style={{ textAlign: 'center', fontSize: 12, color: '#9b8aa1' }}>
                {r.fixtures}
              </div>

              {/* Predicted */}
              <div style={{ textAlign: 'right', fontFamily: "'Instrument Serif', serif", fontSize: 18, color: '#6b5a72' }}>
                {r.pred.toFixed(1)}
              </div>

              {/* Actual */}
              <div style={{ textAlign: 'right', fontFamily: "'Instrument Serif', serif", fontSize: 18, color: '#2a2230' }}>
                {r.actual}
              </div>

              {/* Error */}
              <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: errColor }}>
                {r.error > 0 ? '+' : ''}{r.error.toFixed(1)}
              </div>
            </div>
          );
        })}

        <div style={{ padding: '10px 16px', fontSize: 11, color: '#9b8aa1' }}>
          Error = predicted − actual. Green = within 1 pt. Orange = under-predicted. Red = over-predicted.
          Predictions use only data available before GW{gw} deadline — no hindsight.
          DNP = did not play. DGW = double gameweek (2 fixtures).
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CompareView, calculateProjection, calculateWinProb });
