// Jersey component — renders a football shirt SVG with club colors
// Three styles: flat, textured, minimal (tweakable)

function Jersey({ club, style = 'textured', size = 56, captain = false, vice = false }) {
  const team = window.TEAMS[club] || { primary: '#888', secondary: '#fff', stripe: '#888' };
  const { primary, secondary, stripe } = team;
  const w = size;
  const h = size;

  // Shirt silhouette path (normalized 0-100)
  // Body with shoulders, collar notch, and sleeves
  const shirtPath = `
    M 20 12
    L 32 8
    L 40 14
    L 60 14
    L 68 8
    L 80 12
    L 92 22
    L 84 34
    L 76 30
    L 76 88
    Q 76 92 72 92
    L 28 92
    Q 24 92 24 88
    L 24 30
    L 16 34
    L 8 22
    Z
  `;

  const collarPath = `M 40 14 Q 50 20 60 14`;

  return (
    <svg width={w} height={h} viewBox="0 0 100 100" style={{ display: 'block', filter: 'drop-shadow(0 3px 6px rgba(30,20,40,0.18))' }}>
      <defs>
        <linearGradient id={`sheen-${club}-${style}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.12)" />
        </linearGradient>
        <pattern id={`stripes-${club}`} patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(0)">
          <rect width="6" height="12" fill={primary} />
          <rect x="6" width="6" height="12" fill={stripe} />
        </pattern>
        <pattern id={`pinstripe-${club}`} patternUnits="userSpaceOnUse" width="8" height="8">
          <rect width="8" height="8" fill={primary} />
          <line x1="0" y1="0" x2="0" y2="8" stroke={stripe} strokeWidth="1.2" opacity="0.5" />
        </pattern>
      </defs>

      {/* Shirt body */}
      <path
        d={shirtPath}
        fill={style === 'minimal' ? primary : (club === 'CRY' || club === 'BHA' || club === 'NEW' || club === 'FUL' || club === 'TOT' || club === 'LEE' ? `url(#stripes-${club})` : `url(#pinstripe-${club})`)}
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="1.2"
      />

      {/* Sleeves accent */}
      {style !== 'minimal' && (
        <>
          <path d="M 8 22 L 16 34 L 24 30 L 24 22 Z" fill={secondary} opacity="0.85" />
          <path d="M 92 22 L 84 34 L 76 30 L 76 22 Z" fill={secondary} opacity="0.85" />
        </>
      )}

      {/* Collar */}
      <path d={collarPath} fill="none" stroke={secondary} strokeWidth="3" strokeLinecap="round" />
      <path d={`M 40 14 Q 50 18 60 14 L 58 22 L 42 22 Z`} fill={secondary} opacity="0.7" />

      {/* Sheen overlay */}
      {style === 'textured' && (
        <path d={shirtPath} fill={`url(#sheen-${club}-${style})`} />
      )}

      {/* Captain / Vice armband */}
      {captain && (
        <g>
          <rect x="10" y="30" width="14" height="8" rx="1.5" fill="#F5E9C8" stroke="#1C1B1F" strokeWidth="0.8" />
          <text x="17" y="36" fontSize="7" fontWeight="700" textAnchor="middle" fill="#1C1B1F" fontFamily="Inter, sans-serif">C</text>
        </g>
      )}
      {vice && (
        <g>
          <rect x="10" y="30" width="14" height="8" rx="1.5" fill="#F5E9C8" stroke="#1C1B1F" strokeWidth="0.8" />
          <text x="17" y="36" fontSize="6" fontWeight="700" textAnchor="middle" fill="#1C1B1F" fontFamily="Inter, sans-serif">VC</text>
        </g>
      )}
    </svg>
  );
}

Object.assign(window, { Jersey });
