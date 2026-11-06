(() => {
const Easing = window.Easing || {
  easeInOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  easeOutCubic: t => 1 - Math.pow(1 - t, 3),
};
const C = { yellow:'#FDC74A', ink:'#1F1C2C', cream:'#FBFAF7', gray:'#5E5A70', gold:'#8A6408', sand:'#F3EFE8', line:'#E7E1D6', red:'#C8102E', blue:'#002B7F' };
const UI = "'Plus Jakarta Sans', system-ui, sans-serif";
const DISP = "'Caprasimo', Georgia, serif";
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, p) => a + (b - a) * p;
const ramp = (T, s, e, ease) => ease(cl((T - s) / (e - s)));
// the only three motion curves in the piece
const M = {
  enter: (T, s, e) => ramp(T, s, e, Easing.easeInOutCubic),
  pop: (T, s, e) => ramp(T, s, e, Easing.easeOutBack),
  draw: (T, s, e) => ramp(T, s, e, Easing.easeOutCubic),
};
const Box = ({ x, y, w, h, r = 0, bg, rot = 0, o, op, sc, style, children }) => (
  <div style={{ position:'absolute', left:x, top:y, width:w, height:h, borderRadius:r, background:bg,
    transform: (rot || sc != null) ? `rotate(${rot}deg) scale(${sc == null ? 1 : sc})` : undefined,
    transformOrigin:o, opacity:op, ...style }}>{children}</div>
);

const EVENTS = [
  { key:'Tope', kicker:'TRADICIÓN', title:'Gran tope nacional', date:'Sáb 14 nov · 1:00 pm', place:'Ciudad Quesada, Alajuela', price:'Gratis', day:'14', mon:'NOV', bg:'oklch(0.66 0.13 230)' },
  { key:'Bingo', kicker:'FAMILIA', title:'Gran bingo comunal', date:'Vie 20 nov · 7:00 pm', place:'Salón comunal, San Carlos', price:'₡2.000', day:'20', mon:'NOV', bg:'oklch(0.56 0.15 300)' },
  { key:'Bolos', kicker:'DEPORTES', title:'Noche de bolos', date:'Sáb 21 nov · 8:00 pm', place:'Boliche Plaza, Alajuela', price:'₡4.500', day:'21', mon:'NOV', bg:'oklch(0.6 0.11 195)' },
  { key:'Concierto', kicker:'MÚSICA', title:'Concierto en el bar', date:'Jue 26 nov · 9:00 pm', place:'Bar La Cantina, Heredia', price:'₡6.000', day:'26', mon:'NOV', bg:'#2B2640' },
  { key:'Garage', kicker:'FERIAS', title:'Venta de garage', date:'Sáb 28 nov · 8:00 am', place:'Barrio San Martín, San Carlos', price:'Gratis', day:'28', mon:'NOV', bg:'oklch(0.64 0.12 150)' },
];

// geometry (1080x1920 frame)
const PHONE = { x:140, y:150, w:800, h:1640 };
const SCREEN = { x:160, y:170, w:760, h:1600 };
const S = 760 / 390; // app pt -> frame px
const CARD_STRIDE = 446;
const CARD_IMG = { x: SCREEN.x + 20 * S, y: SCREEN.y + 268 * S, w: 350 * S, h: 270 * S, r: 16 * S };
const TICKET = { x:60, y:110, w:960, h:1340, r:56 };
const STUB_H = 320;
const SW = 960, SH = 1340; // native scene size

// scene shown inside any rect, cover-fit
const SceneView = ({ rect, r, children }) => {
  const s = Math.max(rect.w / SW, rect.h / SH);
  const ox = (rect.w - SW * s) / 2, oy = (rect.h - SH * s) / 2;
  return (
    <div style={{ position:'absolute', left:rect.x, top:rect.y, width:rect.w, height:rect.h, borderRadius:r, overflow:'hidden' }}>
      <div style={{ position:'absolute', left:0, top:0, width:SW, height:SH, transformOrigin:'0 0', transform:`translate(${ox}px,${oy}px) scale(${s})` }}>{children}</div>
    </div>
  );
};

const Icon = ({ d, c, size = 24, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {c && <circle cx={c[0]} cy={c[1]} r={c[2]} />}
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const IC = {
  home: { d:['M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'] },
  search: { c:[11,11,7], d:['M21 21l-4.3-4.3'] },
  mark: { d:['M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'] },
  bell: { d:['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'] },
  user: { c:[12,8,4], d:['M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1'] },
  chat: { d:['M7.9 20A9 9 0 1 0 4 16.1L2 22z'] },
  pin: { c:[12,10,3], d:['M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0'] },
  cal: { d:['M8 2v4','M16 2v4','M3 10h18','M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'] },
  heart: { d:['M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z'] },
  check: { d:['M20 6L9 17l-5-5'] },
};

// the ticket stub (960 x STUB_H native)
const Stub = ({ ev, stamp, bgNotch }) => (
  <div style={{ position:'absolute', left:0, top:0, width:960, height:STUB_H, background:C.cream, borderRadius:'0 0 56px 56px', fontFamily:UI, color:C.ink }}>
    <div style={{ position:'absolute', left:60, right:60, top:0, borderTop:`5px dashed ${C.line}` }}></div>
    <div style={{ position:'absolute', left:70, top:56, right:270, display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ fontSize:26, fontWeight:800, letterSpacing:'0.14em', color:C.gold }}>{ev.kicker}</div>
      <div style={{ fontFamily:DISP, fontSize:58, lineHeight:1.05, whiteSpace:'nowrap' }}>{ev.title}</div>
      <div style={{ fontSize:30, fontWeight:700, marginTop:6 }}>{ev.date}</div>
      <div style={{ fontSize:28, fontWeight:500, color:C.gray }}>{ev.place}</div>
    </div>
    <div style={{ position:'absolute', right:64, top:70, width:190, height:190, borderRadius:'50%', background:C.yellow, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4,
      transform:`rotate(-14deg) scale(${stamp})`, boxShadow:`0 0 0 8px ${C.cream}, 0 0 0 12px ${C.yellow}` }}>
      <Icon {...IC.check} size={64} color={C.ink} />
      <div style={{ fontSize:44, fontWeight:800 }}>Voy</div>
    </div>
    {bgNotch && <div style={{ position:'absolute', left:-40, top:-40, width:80, height:80, borderRadius:'50%', background:bgNotch }}></div>}
    {bgNotch && <div style={{ position:'absolute', right:-40, top:-40, width:80, height:80, borderRadius:'50%', background:bgNotch }}></div>}
  </div>
);

window.PC = { C, UI, DISP, cl, lerp, M, Box, EVENTS, PHONE, SCREEN, S, CARD_STRIDE, CARD_IMG, TICKET, STUB_H, SW, SH, SceneView, Icon, IC, Stub };
})();
