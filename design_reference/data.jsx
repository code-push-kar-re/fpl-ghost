// FPL Ghost — mock data layer
// Placeholder data; replace with real FPL API calls once team IDs are connected.

const TEAMS = {
  ARS: { name: 'Arsenal',         short: 'ARS', primary: '#EF0107', secondary: '#FFFFFF', stripe: '#9C824A' },
  AVL: { name: 'Aston Villa',     short: 'AVL', primary: '#670E36', secondary: '#95BFE5', stripe: '#670E36' },
  BOU: { name: 'Bournemouth',     short: 'BOU', primary: '#DA291C', secondary: '#000000', stripe: '#DA291C' },
  BRE: { name: 'Brentford',       short: 'BRE', primary: '#E30613', secondary: '#FFFFFF', stripe: '#E30613' },
  BHA: { name: 'Brighton',        short: 'BHA', primary: '#0057B8', secondary: '#FFFFFF', stripe: '#0057B8' },
  BUR: { name: 'Burnley',         short: 'BUR', primary: '#6C1D45', secondary: '#99D6EA', stripe: '#6C1D45' },
  CHE: { name: 'Chelsea',         short: 'CHE', primary: '#034694', secondary: '#FFFFFF', stripe: '#034694' },
  CRY: { name: 'Crystal Palace',  short: 'CRY', primary: '#1B458F', secondary: '#C4122E', stripe: '#C4122E' },
  EVE: { name: 'Everton',         short: 'EVE', primary: '#003399', secondary: '#FFFFFF', stripe: '#003399' },
  FUL: { name: 'Fulham',          short: 'FUL', primary: '#FFFFFF', secondary: '#000000', stripe: '#000000' },
  LEE: { name: 'Leeds',           short: 'LEE', primary: '#FFCD00', secondary: '#1D428A', stripe: '#1D428A' },
  LIV: { name: 'Liverpool',       short: 'LIV', primary: '#C8102E', secondary: '#00B2A9', stripe: '#C8102E' },
  MCI: { name: 'Man City',        short: 'MCI', primary: '#6CABDD', secondary: '#FFFFFF', stripe: '#6CABDD' },
  MUN: { name: 'Man United',      short: 'MUN', primary: '#DA291C', secondary: '#FBE122', stripe: '#DA291C' },
  NEW: { name: 'Newcastle',       short: 'NEW', primary: '#241F20', secondary: '#FFFFFF', stripe: '#241F20' },
  NFO: { name: "Nott'm Forest",   short: 'NFO', primary: '#DD0000', secondary: '#FFFFFF', stripe: '#DD0000' },
  SUN: { name: 'Sunderland',      short: 'SUN', primary: '#E30613', secondary: '#FFFFFF', stripe: '#E30613' },
  TOT: { name: 'Tottenham',       short: 'TOT', primary: '#FFFFFF', secondary: '#132257', stripe: '#132257' },
  WHU: { name: 'West Ham',        short: 'WHU', primary: '#7A263A', secondary: '#1BB1E7', stripe: '#7A263A' },
  WOL: { name: 'Wolves',          short: 'WOL', primary: '#FDB913', secondary: '#231F20', stripe: '#231F20' },
};

// Next-5 fixture difficulty (1 easy → 5 hard)
const FIXTURES = {
  LIV: [{ opp: 'CRY', h: true,  fdr: 2 }, { opp: 'EVE', h: false, fdr: 3 }, { opp: 'MCI', h: true,  fdr: 4 }, { opp: 'BOU', h: false, fdr: 2 }, { opp: 'BRE', h: true, fdr: 2 }],
  CHE: [{ opp: 'BUR', h: true,  fdr: 2 }, { opp: 'AVL', h: false, fdr: 3 }, { opp: 'FUL', h: true,  fdr: 2 }, { opp: 'NEW', h: false, fdr: 4 }, { opp: 'LEE', h: true, fdr: 2 }],
  CRY: [{ opp: 'LIV', h: false, fdr: 4 }, { opp: 'WHU', h: true,  fdr: 2 }, { opp: 'BHA', h: false, fdr: 3 }, { opp: 'TOT', h: true,  fdr: 3 }, { opp: 'NFO', h: false, fdr: 3 }],
  TOT: [{ opp: 'BUR', h: false, fdr: 2 }, { opp: 'WOL', h: true,  fdr: 2 }, { opp: 'NFO', h: false, fdr: 3 }, { opp: 'CRY', h: false, fdr: 3 }, { opp: 'MCI', h: true,  fdr: 5 }],
  BOU: [{ opp: 'WOL', h: true,  fdr: 2 }, { opp: 'LEE', h: false, fdr: 2 }, { opp: 'NEW', h: true,  fdr: 4 }, { opp: 'LIV', h: true,  fdr: 5 }, { opp: 'BRE', h: false, fdr: 3 }],
  NEW: [{ opp: 'AVL', h: true,  fdr: 3 }, { opp: 'BHA', h: false, fdr: 3 }, { opp: 'BOU', h: false, fdr: 2 }, { opp: 'CHE', h: true,  fdr: 4 }, { opp: 'SUN', h: false, fdr: 2 }],
  LEE: [{ opp: 'EVE', h: true,  fdr: 3 }, { opp: 'BOU', h: true,  fdr: 2 }, { opp: 'WOL', h: false, fdr: 2 }, { opp: 'SUN', h: true,  fdr: 2 }, { opp: 'CHE', h: false, fdr: 4 }],
  MCI: [{ opp: 'BRE', h: true,  fdr: 2 }, { opp: 'WOL', h: false, fdr: 2 }, { opp: 'LIV', h: false, fdr: 4 }, { opp: 'BUR', h: true,  fdr: 2 }, { opp: 'TOT', h: false, fdr: 3 }],
  BHA: [{ opp: 'FUL', h: false, fdr: 2 }, { opp: 'NEW', h: true,  fdr: 3 }, { opp: 'CRY', h: true,  fdr: 3 }, { opp: 'WHU', h: false, fdr: 2 }, { opp: 'ARS', h: true,  fdr: 5 }],
  ARS: [{ opp: 'MUN', h: true,  fdr: 4 }, { opp: 'NFO', h: false, fdr: 3 }, { opp: 'SUN', h: true,  fdr: 2 }, { opp: 'WOL', h: false, fdr: 2 }, { opp: 'BHA', h: false, fdr: 3 }],
  NFO: [{ opp: 'WHU', h: false, fdr: 2 }, { opp: 'ARS', h: true,  fdr: 5 }, { opp: 'TOT', h: true,  fdr: 3 }, { opp: 'MUN', h: false, fdr: 4 }, { opp: 'CRY', h: true,  fdr: 3 }],
  BUR: [{ opp: 'CHE', h: false, fdr: 5 }, { opp: 'TOT', h: true,  fdr: 3 }, { opp: 'SUN', h: true,  fdr: 2 }, { opp: 'MCI', h: false, fdr: 5 }, { opp: 'AVL', h: true,  fdr: 3 }],
};

// My squad — 15 players in FPL format
// pos: 1=GK, 2=DEF, 3=MID, 4=FWD
// status: 'a' available, 'i' injured, 'd' doubt (%), 's' suspended, 'u' unavailable
// flags: dgw (double gameweek), bgw (blank), card (yellow card suspension risk)
const MY_SQUAD = [
  { id: 'p1',  name: 'Sánchez',       last: 'Sánchez',    first: 'Robert',   club: 'CHE', pos: 1, price: 5.0,  proj: 4.8,  form: 4.2, selected: 18.3, captain: false, vice: false, startIdx: 0,  status: 'a', news: null },
  { id: 'p2',  name: 'Pedro Porro',   last: 'P.PORRO',    first: 'Pedro',    club: 'TOT', pos: 2, price: 5.5,  proj: 5.1,  form: 5.4, selected: 22.1, captain: false, vice: false, startIdx: 1,  status: 'd', chance: 75, news: 'Knock — 75% chance of playing' },
  { id: 'p3',  name: 'Rodon',         last: 'RODON',      first: 'Joe',      club: 'LEE', pos: 2, price: 4.0,  proj: 3.8,  form: 3.1, selected: 8.2,  captain: false, vice: false, startIdx: 2,  status: 'a', news: null, card: { yellows: 4, risk: 'high' } },
  { id: 'p4',  name: 'Guðmundsson',   last: 'GUÐMUND.',   first: 'Mikkel',   club: 'LEE', pos: 2, price: 4.0,  proj: 3.6,  form: 2.8, selected: 5.4,  captain: false, vice: false, startIdx: 3,  status: 'a', news: null },
  { id: 'p5',  name: 'Palmer',        last: 'PALMER',     first: 'Cole',     club: 'CHE', pos: 3, price: 10.5, proj: 7.2,  form: 6.8, selected: 41.2, captain: false, vice: true,  startIdx: 4,  status: 'a', news: null, dgw: true },
  { id: 'p6',  name: 'M.Salah',       last: 'M.SALAH',    first: 'Mo',       club: 'LIV', pos: 3, price: 14.5, proj: 9.4,  form: 8.7, selected: 58.3, captain: true,  vice: false, startIdx: 5,  status: 'a', news: null },
  { id: 'p7',  name: 'Wirtz',         last: 'WIRTZ',      first: 'Florian',  club: 'LIV', pos: 3, price: 8.5,  proj: 6.1,  form: 5.9, selected: 24.8, captain: false, vice: false, startIdx: 6,  status: 'd', chance: 50, news: 'Hamstring — 50% chance of playing' },
  { id: 'p8',  name: 'Tielemans',     last: 'TIELEMANS',  first: 'Youri',    club: 'AVL', pos: 3, price: 6.0,  proj: 4.7,  form: 4.3, selected: 12.1, captain: false, vice: false, startIdx: 7,  status: 'a', news: null },
  { id: 'p9',  name: 'Ndiaye',        last: 'NDIAYE',     first: 'Iliman',   club: 'EVE', pos: 3, price: 6.5,  proj: 4.9,  form: 5.2, selected: 14.6, captain: false, vice: false, startIdx: 8,  status: 'a', news: null, bgw: true },
  { id: 'p10', name: 'Bowen',         last: 'BOWEN',      first: 'Jarrod',   club: 'WHU', pos: 4, price: 8.0,  proj: 5.8,  form: 5.1, selected: 19.4, captain: false, vice: false, startIdx: 9,  status: 'a', news: null },
  { id: 'p11', name: 'Wood',          last: 'WOOD',       first: 'Chris',    club: 'NFO', pos: 4, price: 7.5,  proj: 5.4,  form: 6.2, selected: 28.7, captain: false, vice: false, startIdx: 10, status: 'i', news: 'Calf — out until 15 May' },
  // Bench
  { id: 'p12', name: 'Kelleher',      last: 'KELLEHER',   first: 'Caoimhín', club: 'BRE', pos: 1, price: 4.5,  proj: 3.2,  form: 3.0, selected: 4.1,  captain: false, vice: false, startIdx: 11, status: 'a', news: null },
  { id: 'p13', name: 'Strand Larsen', last: 'S.LARSEN',   first: 'Jørgen',   club: 'WOL', pos: 4, price: 6.5,  proj: 4.2,  form: 4.0, selected: 11.8, captain: false, vice: false, startIdx: 12, status: 'a', news: null, card: { yellows: 4, risk: 'high' } },
  { id: 'p14', name: 'Andersen',      last: 'ANDERSEN',   first: 'Joachim',  club: 'FUL', pos: 2, price: 4.5,  proj: 3.4,  form: 3.2, selected: 7.3,  captain: false, vice: false, startIdx: 13, status: 's', news: 'Suspended — 1 match ban' },
  { id: 'p15', name: 'Estève',        last: 'ESTÈVE',     first: 'Maxime',   club: 'BUR', pos: 2, price: 4.0,  proj: 2.9,  form: 2.5, selected: 3.2,  captain: false, vice: false, startIdx: 14, status: 'a', news: null },
];

// Rival's squad for compare view
const RIVAL_SQUAD = [
  { id: 'r1',  name: 'Raya',          last: 'RAYA',       first: 'David',    club: 'ARS', pos: 1, price: 5.5,  proj: 4.9,  form: 4.5, captain: false, vice: false, startIdx: 0 },
  { id: 'r2',  name: 'Gabriel',       last: 'GABRIEL',    first: 'Magalhães',club: 'ARS', pos: 2, price: 6.0,  proj: 5.4,  form: 5.1, captain: false, vice: false, startIdx: 1 },
  { id: 'r3',  name: 'Van Dijk',      last: 'V.DIJK',     first: 'Virgil',   club: 'LIV', pos: 2, price: 6.0,  proj: 5.0,  form: 4.7, captain: false, vice: false, startIdx: 2 },
  { id: 'r4',  name: 'Burn',          last: 'BURN',       first: 'Dan',      club: 'NEW', pos: 2, price: 4.5,  proj: 3.9,  form: 3.6, captain: false, vice: false, startIdx: 3 },
  { id: 'r5',  name: 'Saka',          last: 'SAKA',       first: 'Bukayo',   club: 'ARS', pos: 3, price: 10.0, proj: 7.0,  form: 6.5, captain: false, vice: true,  startIdx: 4 },
  { id: 'r6',  name: 'M.Salah',       last: 'M.SALAH',    first: 'Mo',       club: 'LIV', pos: 3, price: 14.5, proj: 9.4,  form: 8.7, captain: true,  vice: false, startIdx: 5 },
  { id: 'r7',  name: 'Palmer',        last: 'PALMER',     first: 'Cole',     club: 'CHE', pos: 3, price: 10.5, proj: 7.2,  form: 6.8, captain: false, vice: false, startIdx: 6 },
  { id: 'r8',  name: 'Gordon',        last: 'GORDON',     first: 'Anthony',  club: 'NEW', pos: 3, price: 7.5,  proj: 5.3,  form: 4.8, captain: false, vice: false, startIdx: 7 },
  { id: 'r9',  name: 'Mbeumo',        last: 'MBEUMO',     first: 'Bryan',    club: 'MUN', pos: 3, price: 8.0,  proj: 5.6,  form: 5.4, captain: false, vice: false, startIdx: 8 },
  { id: 'r10', name: 'Haaland',       last: 'HAALAND',    first: 'Erling',   club: 'MCI', pos: 4, price: 15.0, proj: 8.8,  form: 8.2, captain: false, vice: false, startIdx: 9 },
  { id: 'r11', name: 'Wood',          last: 'WOOD',       first: 'Chris',    club: 'NFO', pos: 4, price: 7.5,  proj: 5.4,  form: 6.2, captain: false, vice: false, startIdx: 10 },
  { id: 'r12', name: 'Martinez',      last: 'MARTINEZ',   first: 'Emi',      club: 'AVL', pos: 1, price: 5.0,  proj: 3.8,  form: 3.4, captain: false, vice: false, startIdx: 11 },
  { id: 'r13', name: 'Cunha',         last: 'CUNHA',      first: 'Matheus',  club: 'MUN', pos: 4, price: 7.0,  proj: 4.3,  form: 4.1, captain: false, vice: false, startIdx: 12 },
  { id: 'r14', name: 'Rogers',        last: 'ROGERS',     first: 'Morgan',   club: 'AVL', pos: 3, price: 5.5,  proj: 3.7,  form: 3.5, captain: false, vice: false, startIdx: 13 },
  { id: 'r15', name: 'Tarkowski',     last: 'TARKOWSKI',  first: 'James',    club: 'EVE', pos: 2, price: 4.5,  proj: 3.0,  form: 2.8, captain: false, vice: false, startIdx: 14 },
];

// Multiple mini-leagues
const MY_LEAGUES = [
  { id: 'lg1', name: 'Chips & Crisps FC', code: '7k3n-4fq2', size: 12, myRank: 1, prevRank: 2, active: true },
  { id: 'lg2', name: 'Work Warriors',     code: 'x9p2-bt4q', size: 28, myRank: 7, prevRank: 5 },
  { id: 'lg3', name: 'Uni Alumni 2015',   code: 'mk7v-9hr1', size: 45, myRank: 14, prevRank: 18 },
  { id: 'lg4', name: 'Family Showdown',   code: 'fm42-plz0', size: 6,  myRank: 2, prevRank: 3 },
  { id: 'lg5', name: 'Overall (Global)',  code: null, size: 11_384_221, myRank: 284_117, prevRank: 301_442, isGlobal: true },
];

// Mini-league standings
const MINI_LEAGUE = [
  { rank: 1,  prev: 1,  manager: 'Theo Martens',   team: 'Ghost Protocol',    total: 1847, gw: 72, id: 'me',    isMe: true },
  { rank: 2,  prev: 3,  manager: 'Danny Park',     team: 'The Haaland Plan',  total: 1839, gw: 68, id: 'rival', isMe: false },
  { rank: 3,  prev: 2,  manager: 'Priya Shah',     team: 'Xhaka Khan',        total: 1831, gw: 54, id: 'u3' },
  { rank: 4,  prev: 4,  manager: 'Marcus Bell',    team: 'Salah Dente',       total: 1812, gw: 61, id: 'u4' },
  { rank: 5,  prev: 7,  manager: 'Sofía Reyes',    team: 'Pep Talks',         total: 1798, gw: 81, id: 'u5' },
  { rank: 6,  prev: 5,  manager: 'Kenji Ito',      team: 'Offside & Sound',   total: 1784, gw: 49, id: 'u6' },
  { rank: 7,  prev: 6,  manager: 'Ada Nwosu',      team: 'Wirtz So Bad',      total: 1772, gw: 58, id: 'u7' },
  { rank: 8,  prev: 8,  manager: 'Jonah West',     team: 'Total Footballing', total: 1759, gw: 45, id: 'u8' },
  { rank: 9,  prev: 11, manager: 'Luca Moretti',   team: 'Palmerston North',  total: 1741, gw: 67, id: 'u9' },
  { rank: 10, prev: 9,  manager: 'Harriet Quinn',  team: 'Point & Shoot',     total: 1736, gw: 52, id: 'u10' },
  { rank: 11, prev: 10, manager: 'Oskar Lindqvist', team: 'Nordic Press',     total: 1722, gw: 48, id: 'u11' },
  { rank: 12, prev: 12, manager: 'Rania Haddad',   team: 'Tactical Chaos',    total: 1705, gw: 44, id: 'u12' },
];

// GW timeline projections for planner
const GW_TIMELINE = [
  { gw: 1, proj: 62.4, actual: null, ft: 15, itb: 0.5, chip: null, active: true },
  { gw: 2, proj: 58.6, actual: null, ft: 14, itb: 0.5, chip: null },
  { gw: 3, proj: 64.8, actual: null, ft: 13, itb: 0.2, chip: null },
  { gw: 4, proj: 60.1, actual: null, ft: 12, itb: 0.2, chip: 'TC' },
  { gw: 5, proj: 67.3, actual: null, ft: 11, itb: 0.7, chip: null },
];

// Live gameweek tracker — matches in progress
const LIVE_MATCHES = [
  { home: 'LIV', away: 'CRY', hScore: 2, aScore: 0, minute: 67, status: 'LIVE' },
  { home: 'CHE', away: 'BUR', hScore: 1, aScore: 1, minute: 43, status: 'LIVE' },
  { home: 'TOT', away: 'BOU', hScore: 0, aScore: 0, minute: 12, status: 'LIVE' },
  { home: 'MCI', away: 'BRE', hScore: null, aScore: null, minute: null, status: '17:30' },
  { home: 'NEW', away: 'AVL', hScore: null, aScore: null, minute: null, status: '20:00' },
  { home: 'ARS', away: 'MUN', hScore: null, aScore: null, minute: null, status: 'SUN 16:30' },
];

// Distribution samples for the bell curve
function generateDistribution(mean, stddev, count = 200) {
  const pts = [];
  for (let x = 0; x <= 150; x += 1) {
    const y = Math.exp(-0.5 * Math.pow((x - mean) / stddev, 2)) / (stddev * Math.sqrt(2 * Math.PI));
    pts.push({ x, y });
  }
  return pts;
}

const MY_DIST = { mean: 63.9, stddev: 15.2, p40: 96.5, p60: 61.6, p80: 11.2 };
const RIVAL_DIST = { mean: 61.2, stddev: 16.8, p40: 93.1, p60: 54.8, p80: 9.4 };

Object.assign(window, {
  TEAMS, FIXTURES, MY_SQUAD, RIVAL_SQUAD, MINI_LEAGUE, MY_LEAGUES,
  GW_TIMELINE, LIVE_MATCHES, MY_DIST, RIVAL_DIST, generateDistribution,
});
