// Design tokens — Enfiestados UX_DESIGN_SYSTEM.md v1.1
// ÚNICO lugar donde se permiten valores hex, px y ms.
// Todo el resto del código importa desde acá.

// ─── Color ────────────────────────────────────────────────────────────────────

const _dark = {
  'bg.base':        '#17131F',
  'bg.surface':     '#211C2C',
  'bg.raised':      '#2C2639',
  'bg.overlay':     'rgba(11,9,16,0.62)',

  'border.subtle':  'rgba(255,255,255,0.09)',
  'border.strong':  'rgba(255,255,255,0.16)',

  'text.primary':   '#F7F4EF',
  'text.secondary': '#C6BFD6',
  'text.tertiary':  '#9A91AD',
  'text.onAction':  '#17131F',

  'action.primary':          '#FFC94A',
  'action.primary.pressed':  '#F2B738',
  'action.primary.disabled': 'rgba(255,255,255,0.05)',

  'nav.selected': '#8B6BFF',
  'link':         '#B9A5FF',

  'status.urgent':    '#E1483F',
  'status.urgent.bg': 'rgba(225,72,63,0.18)',
  'status.free':      '#2FBF87',
  'status.free.bg':   'rgba(47,191,135,0.18)',
  'status.info':      '#4AA3FF',
  'status.warning':   '#FFB020',

  'focus.ring': 'rgba(139,107,255,0.45)',
};

const _light = {
  'bg.base':        '#FDFBF7',
  'bg.surface':     '#F4F0E9',
  'bg.raised':      '#FFFFFF',
  'bg.overlay':     'rgba(23,19,32,0.45)',

  'border.subtle':  'rgba(23,19,32,0.10)',
  'border.strong':  '#E0D9CD',

  'text.primary':   '#171320',
  'text.secondary': '#4A4258',
  'text.tertiary':  '#6E6680',
  'text.onAction':  '#17131F',

  'action.primary':          '#FFC94A',
  'action.primary.pressed':  '#F2B738',
  'action.primary.disabled': '#EFEAE1',

  'nav.selected': '#5B3BD4',
  'link':         '#5B3BD4',

  'status.urgent':    '#C7362E',
  'status.urgent.bg': '#FBE3E1',
  'status.free':      '#1B8E62',
  'status.free.bg':   '#DCF4E9',
  'status.info':      '#1D6FD0',
  'status.warning':   '#9A6300',

  'focus.ring': 'rgba(91,59,212,0.35)',
};

// ─── Spacing ──────────────────────────────────────────────────────────────────

const space = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,   // margen lateral único de pantalla
  6:  24,
  8:  32,
  12: 48,
  16: 64,
};

// ─── Radius ───────────────────────────────────────────────────────────────────

const radius = {
  sm:   8,
  md:   12,
  lg:   20,
  xl:   28,
  full: 999,
};

// ─── Tipografía ───────────────────────────────────────────────────────────────

const font = {
  display:     { fontFamily: 'BricolageGrotesque_700Bold',    fontSize: 34, lineHeight: 40, letterSpacing: -0.68 },
  h1:          { fontFamily: 'BricolageGrotesque_700Bold',    fontSize: 28, lineHeight: 32, letterSpacing: -0.56 },
  h2:          { fontFamily: 'BricolageGrotesque_700Bold',    fontSize: 24, lineHeight: 28, letterSpacing: -0.36 },
  h3:          { fontFamily: 'PlusJakartaSans_700Bold',       fontSize: 20, lineHeight: 26, letterSpacing: 0 },
  title:       { fontFamily: 'PlusJakartaSans_700Bold',       fontSize: 17, lineHeight: 24, letterSpacing: 0 },
  subtitle:    { fontFamily: 'PlusJakartaSans_600SemiBold',   fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  body:        { fontFamily: 'PlusJakartaSans_400Regular',    fontSize: 17, lineHeight: 26, letterSpacing: 0 },
  bodyStrong:  { fontFamily: 'PlusJakartaSans_700Bold',       fontSize: 17, lineHeight: 26, letterSpacing: 0 },
  label:       { fontFamily: 'PlusJakartaSans_700Bold',       fontSize: 15, lineHeight: 20, letterSpacing: 0 },
  caption:     { fontFamily: 'PlusJakartaSans_500Medium',     fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  overline:    { fontFamily: 'PlusJakartaSans_800ExtraBold',  fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  tabLabel:    { fontFamily: 'PlusJakartaSans_600SemiBold',   fontSize: 11.5, lineHeight: 14, letterSpacing: 0 },
  // Número dentro de un badge circular chico (contador de filtros, de tab).
  // FIX_ROUND_4 § 6b: 9px estaba por debajo del propio mínimo del sistema
  // (tabLabel = 11.5) — declarado como token en vez de fontSize inline.
  badgeNum:    { fontFamily: 'PlusJakartaSans_700Bold',        fontSize: 11,   lineHeight: 13, letterSpacing: 0 },
};

// ─── Elevación ────────────────────────────────────────────────────────────────

const elev = {
  // En oscuro la elevación es tono (via bg.*); la sombra solo en claro.
  // Usar con el token de bg correspondiente según el tema activo.
  0: {},
  1: {
    shadowColor: '#17131F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  2: {
    shadowColor: '#17131F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 12,
  },
};

// ─── Movimiento ───────────────────────────────────────────────────────────────

const motion = {
  fast:     120,
  base:     200,
  emphasis: 320,
  sheet:    380,
  easeOut:  [0.4, 0, 1, 1],
  easeIn:   [0.2, 0.8, 0.2, 1],
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const darkColors  = _dark;
export const lightColors = _light;
export { space, radius, font, elev, motion };
