// Compare view — side-by-side pitches + win probability + player-by-player diff

function CompareView({ mySquad, rivalSquad, setMySquad, setRivalSquad, jerseyStyle }) {
  const myProj = calculateProjection(mySquad);
  const rivalProj = calculateProjection(rivalSquad);
  const delta = myProj - rivalProj;
  const winProb = calculateWinProb(myProj, rivalProj, 15.2, 16.8);

  const shared = [];
  const myOnly = [];
  const rivalOnly = [];
  mySquad.slice(0, 11).forEach(p => {
    const inRival = rivalSquad.slice(0, 11).find(r => r.id === p.id);
    if (inRival) shared.push(p);
    else myOnly.push(p);
  });
  rivalSquad.slice(0, 11).forEach(r => {
    if (!mySquad.slice(0, 11).find(p => p.id === r.id)) rivalOnly.push(r);
  });

  return (
    <div style={{ padding: '20px 24px 40px' }}>
      {/* Header — Win probability hero */}
      <WinProbabilityHero
        myProj={myProj}
        rivalProj={rivalProj}
        delta={delta}
        winProb={winProb}
      />

      {/* Live transfer simulator */}
      <window.CompareSimulator
        mySquad={mySquad}
        setMySquad={setMySquad}
        rivalSquad={rivalSquad}
        jerseyStyle={jerseyStyle}
      />

      {/* Status alert if flags present */}
      <div style={{ marginTop: 16 }}>
        <window.StatusAlertBanner squad={mySquad} />
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
          <PitchView squad={mySquad} setSquad={setMySquad} jerseyStyle={jerseyStyle} compact showSubtitle={false} />
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
          <PitchView squad={rivalSquad} setSquad={setRivalSquad} jerseyStyle={jerseyStyle} compact showSubtitle={false} interactive={false} />
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

      {/* 5-GW Horizon */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 26, fontWeight: 400, color: '#3a2d44', margin: '0 0 14px',
        }}>5-gameweek outlook</h3>
        <GwHorizonChart mySquad={mySquad} rivalSquad={rivalSquad} />
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

function WinProbabilityHero({ myProj, rivalProj, delta, winProb }) {
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
        label="Win probability"
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

function GwHorizonChart({ mySquad, rivalSquad }) {
  const gws = (mySquad[0]?.xpByGw || []).map(g => g.gw);
  if (!gws.length) return null;

  const myGwTotals = gws.map(gw => {
    return mySquad.slice(0, 11).reduce((sum, p) => {
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
          return (
            <div key={gw} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
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
              <div style={{ fontSize: 10, color: '#9b8aa1', letterSpacing: 0.2, textAlign: 'center' }}>
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
function calculateProjection(squad) {
  const starters = squad.slice(0, 11);
  return starters.reduce((sum, p) => {
    const mult = p.captain ? 2 : 1;
    return sum + p.proj * mult;
  }, 0);
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

Object.assign(window, { CompareView, calculateProjection, calculateWinProb });
