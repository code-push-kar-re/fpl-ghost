// Player status flags — injury, suspension, card risk, BGW, DGW
// Rendered as small badges on player cards and detail pills in lists.

function StatusBadge({ player, size = 16 }) {
  const badges = [];
  if (player.status === 'i' || player.status === 'u') {
    badges.push({ icon: '✚', bg: '#c54b4b', title: player.news || 'Injured' });
  } else if (player.status === 's') {
    badges.push({ icon: '✕', bg: '#b85a4e', title: player.news || 'Suspended' });
  } else if (player.status === 'd') {
    badges.push({ icon: `${player.chance}`, bg: player.chance >= 75 ? '#e8a83c' : '#d97a3a', title: player.news || 'Doubt', wide: true });
  }
  if (player.card?.risk === 'high') {
    badges.push({ icon: '▮', bg: '#f0c419', fg: '#2a2230', title: `${player.card.yellows} yellows — 1 more = ban` });
  }
  if (player.dgw) {
    badges.push({ icon: '2×', bg: '#4a7a4a', title: 'Double gameweek', wide: true });
  }
  if (player.bgw) {
    badges.push({ icon: '0', bg: '#7a6f7e', title: 'Blank gameweek' });
  }
  if (badges.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: -4,
      right: -4,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      zIndex: 5,
    }}>
      {badges.map((b, i) => (
        <div
          key={i}
          title={b.title}
          style={{
            minWidth: b.wide ? size + 6 : size,
            height: size,
            padding: b.wide ? '0 4px' : 0,
            borderRadius: size / 2,
            background: b.bg,
            color: b.fg || '#fff',
            fontSize: size * 0.55,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1.5px #FDFAF4',
            lineHeight: 1,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {b.icon}
        </div>
      ))}
    </div>
  );
}

function StatusPill({ player, inline = true }) {
  if (!player) return null;
  const statuses = [];
  if (player.status === 'i') statuses.push({ label: 'INJ', color: '#c54b4b' });
  if (player.status === 's') statuses.push({ label: 'SUS', color: '#b85a4e' });
  if (player.status === 'd') statuses.push({ label: `${player.chance}%`, color: player.chance >= 75 ? '#e8a83c' : '#d97a3a' });
  if (player.card?.risk === 'high') statuses.push({ label: 'CARD', color: '#c59018' });
  if (player.dgw) statuses.push({ label: 'DGW', color: '#4a7a4a' });
  if (player.bgw) statuses.push({ label: 'BGW', color: '#7a6f7e' });

  if (statuses.length === 0) return null;

  return (
    <span style={{
      display: inline ? 'inline-flex' : 'flex',
      gap: 4,
      flexWrap: 'wrap',
      marginLeft: inline ? 6 : 0,
    }}>
      {statuses.map((s, i) => (
        <span key={i} style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.4,
          padding: '2px 5px',
          background: `${s.color}1A`,
          color: s.color,
          borderRadius: 3,
          lineHeight: 1.3,
        }}>{s.label}</span>
      ))}
    </span>
  );
}

// Banner at top summarizing status issues
function StatusAlertBanner({ squad }) {
  const starters = squad.slice(0, 11);
  const issues = starters.filter(p =>
    p.status === 'i' || p.status === 's' || p.status === 'u' ||
    (p.status === 'd' && (p.chance || 100) < 75) ||
    p.card?.risk === 'high' || p.bgw
  );
  if (issues.length === 0) return null;

  const severity = issues.some(p => p.status === 'i' || p.status === 's' || p.status === 'u') ? 'high' : 'medium';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px',
      background: severity === 'high' ? 'rgba(197, 75, 75, 0.08)' : 'rgba(232, 168, 60, 0.1)',
      border: `1px solid ${severity === 'high' ? 'rgba(197, 75, 75, 0.2)' : 'rgba(232, 168, 60, 0.25)'}`,
      borderRadius: 10,
      marginBottom: 16,
      fontSize: 12,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: severity === 'high' ? '#c54b4b' : '#e8a83c',
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, flexShrink: 0,
      }}>!</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: '#2a2230', marginBottom: 2 }}>
          {issues.length} flag{issues.length > 1 ? 's' : ''} on your starting XI
        </div>
        <div style={{ color: '#6b5a72', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {issues.slice(0, 4).map(p => (
            <span key={p.id}>
              <strong style={{ color: '#2a2230' }}>{p.name}</strong>
              <StatusPill player={p} />
            </span>
          ))}
          {issues.length > 4 && <span style={{ color: '#8a7a90' }}>+{issues.length - 4} more</span>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { StatusBadge, StatusPill, StatusAlertBanner });
