(() => {
const { C, UI, lerp, Box, EVENTS, SceneView, Icon, IC } = window.PC;
const PS = window.PS;
const THUMB_U = { Tope: 1.6, Bingo: 1.7, Bolos: 1.2, Concierto: 1.5, Garage: 2.0 };
const Thumb = ({ ev, rect, r }) => { const Sc = PS[ev.key]; return <SceneView rect={rect} r={r}><Sc u={THUMB_U[ev.key]} /></SceneView>; };

const FeedCard = ({ ev, hideImg, done }) => (
  <div style={{ position:'relative', width:350, height:430, borderRadius:16, overflow:'hidden', background:C.sand, border:`1px solid ${C.line}`, boxSizing:'border-box' }}>
    <div style={{ position:'absolute', left:0, top:0, width:350, height:270, opacity:hideImg ? 0 : 1 }}>
      <Thumb ev={ev} rect={{ x:0, y:0, w:350, h:270 }} r={0} />
      <div style={{ position:'absolute', left:12, top:12, width:54, height:62, borderRadius:12, background:'rgba(31,28,44,.92)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:UI }}>
        <div style={{ color:C.yellow, fontWeight:800, fontSize:22, lineHeight:1 }}>{ev.day}</div>
        <div style={{ color:C.cream, fontWeight:700, fontSize:11, letterSpacing:'0.12em', marginTop:4 }}>{ev.mon}</div>
      </div>
    </div>
    <div style={{ position:'absolute', left:18, right:18, top:280, display:'flex', flexDirection:'column', gap:4, fontFamily:UI, lineHeight:1.25 }}>
      <div style={{ fontSize:11, fontWeight:800, letterSpacing:'0.14em', color:C.gold }}>{ev.kicker}</div>
      <div style={{ fontSize:21, fontWeight:800, color:C.ink, letterSpacing:'-0.01em' }}>{ev.title}</div>
      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:700, color:C.ink }}><Icon {...IC.cal} size={15} color={C.yellow} />{ev.date}</div>
      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:500, color:C.gray }}><Icon {...IC.pin} size={15} color={C.gray} />{ev.place}</div>
    </div>
    <div style={{ position:'absolute', left:18, right:18, bottom:12, display:'flex', alignItems:'center', gap:14, fontFamily:UI, lineHeight:1.2 }}>
      <div style={{ flex:1, fontSize:19, fontWeight:800, color:C.ink }}>{ev.price}</div>
      <Icon {...IC.heart} size={22} color={C.ink} />
      <div style={{ height:38, padding:'0 18px', borderRadius:12, background:done ? C.ink : C.yellow, color:done ? C.yellow : C.ink, display:'flex', alignItems:'center', gap:6, fontSize:15, fontWeight:800 }}>
        {done && <Icon {...IC.check} size={16} color={C.yellow} />}Voy
      </div>
    </div>
  </div>
);

const PlanRow = ({ ev, p }) => (
  <div style={{ position:'relative', height:96, borderRadius:16, background:C.yellow, display:'flex', alignItems:'center', gap:12, padding:'0 12px', fontFamily:UI,
    transform:`translateY(${(1 - p) * -60}px) scale(${lerp(0.9, 1, p)})`, opacity:p, boxShadow:'0 6px 16px rgba(31,28,44,.10)' }}>
    <div style={{ position:'relative', width:72, height:72, flexShrink:0 }}><Thumb ev={ev} rect={{ x:0, y:0, w:72, h:72 }} r={12} /></div>
    <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:2 }}>
      <div style={{ fontSize:10, fontWeight:800, letterSpacing:'0.14em', color:C.gold }}>{ev.kicker}</div>
      <div style={{ fontSize:16, fontWeight:800, color:C.ink, whiteSpace:'nowrap' }}>{ev.title}</div>
      <div style={{ fontSize:12, fontWeight:600, color:C.ink }}>{ev.date}</div>
    </div>
    <div style={{ width:0, alignSelf:'stretch', borderLeft:'2px dashed rgba(31,28,44,.25)', margin:'10px 0' }}></div>
    <div style={{ width:44, display:'flex', justifyContent:'center' }}><Icon {...IC.check} size={24} color={C.ink} /></div>
    <div style={{ position:'absolute', right:58, top:-8, width:16, height:16, borderRadius:8, background:C.cream }}></div>
    <div style={{ position:'absolute', right:58, bottom:-8, width:16, height:16, borderRadius:8, background:C.cream }}></div>
  </div>
);

const TabBar = ({ active }) => {
  const tabs = [['Inicio', IC.home], ['Explorar', IC.search], ['Mis planes', IC.mark], ['Alertas', IC.bell], ['Perfil', IC.user]];
  return (
    <div style={{ position:'absolute', left:0, right:0, bottom:0, height:84, background:C.cream, borderTop:`1px solid ${C.line}`, display:'flex', paddingTop:10, fontFamily:UI }}>
      {tabs.map(([l, ic], i) => (
        <div key={l} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:i === active ? '#E9A800' : C.gray }}>
          <Icon {...ic} size={24} color={i === active ? '#F5B400' : C.gray} />{l}
        </div>
      ))}
    </div>
  );
};

// App at native iOS points: 390 x 821
const App = ({ scroll, done, hideIdx, planes, planesIn }) => (
  <div style={{ position:'absolute', left:0, top:0, width:390, height:821, background:C.cream, overflow:'hidden', fontFamily:UI, color:C.ink }}>
    <div style={{ position:'absolute', left:30, top:16, fontSize:15, fontWeight:700 }}>9:41</div>
    <div style={{ position:'absolute', right:28, top:18, display:'flex', gap:6, alignItems:'center' }}>
      <div style={{ width:18, height:11, borderRadius:2, background:C.ink }}></div>
      <div style={{ width:25, height:12, borderRadius:4, border:`1.5px solid ${C.ink}`, padding:1.5, boxSizing:'border-box' }}><div style={{ width:'70%', height:'100%', borderRadius:2, background:C.ink }}></div></div>
    </div>
    <div style={{ position:'absolute', inset:0, opacity:1 - planes }}>
      <div style={{ position:'absolute', left:20, right:20, top:58, display:'flex', alignItems:'center', gap:12 }}>
        <img src="assets/logo.png" style={{ width:40, height:40, borderRadius:10 }} />
        <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:17, fontWeight:800 }}>Enfiestados</div>
          <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:13, color:C.gray }}><Icon {...IC.pin} size={13} color={C.gray} />Alajuela</div>
        </div>
        <Icon {...IC.chat} size={24} color={C.ink} />
        <div style={{ height:38, padding:'0 16px', borderRadius:19, background:C.yellow, display:'flex', alignItems:'center', fontSize:15, fontWeight:800 }}>+ Crear</div>
      </div>
      <div style={{ position:'absolute', left:20, right:20, top:128, height:50, borderRadius:14, background:C.sand, display:'flex', padding:4, boxSizing:'border-box', fontSize:15, fontWeight:700 }}>
        <div style={{ flex:1, borderRadius:11, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>Para vos</div>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:C.gray }}>Siguiendo</div>
      </div>
      <div style={{ position:'absolute', left:20, top:200, display:'flex', gap:8 }}>
        {['Hoy', 'Este finde', 'Gratis'].map(c => <div key={c} style={{ height:40, padding:'0 14px', borderRadius:13, border:`1.5px solid ${C.line}`, background:C.sand, display:'flex', alignItems:'center', fontSize:14, fontWeight:700, color:C.gray, whiteSpace:'nowrap', flexShrink:0 }}>{c}</div>)}
      </div>
      <div style={{ position:'absolute', left:0, right:0, top:258, bottom:0, overflow:'hidden' }}>
        <div style={{ position:'absolute', left:20, top:10 - scroll, display:'flex', flexDirection:'column', gap:16 }}>
          {EVENTS.map((ev, i) => <FeedCard key={ev.key} ev={ev} hideImg={hideIdx === i} done={done[i]} />)}
        </div>
      </div>
    </div>
    <div style={{ position:'absolute', inset:0, opacity:planes }}>
      <div style={{ position:'absolute', left:20, top:58, display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ fontSize:30, fontWeight:800, letterSpacing:'-0.02em' }}>Mis planes</div>
        <div style={{ width:30, height:30, borderRadius:15, background:C.yellow, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800 }}>5</div>
      </div>
      <div style={{ position:'absolute', left:20, right:20, top:112, height:46, borderRadius:14, background:C.sand, display:'flex', padding:4, boxSizing:'border-box', fontSize:15, fontWeight:700 }}>
        <div style={{ flex:1, borderRadius:11, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>Voy</div>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:C.gray }}>Guardados</div>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:C.gray }}>Entradas</div>
      </div>
      <div style={{ position:'absolute', left:20, right:20, top:182, display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ fontSize:12, fontWeight:800, letterSpacing:'0.14em', color:C.gray }}>EN NOVIEMBRE</div>
        {EVENTS.map((ev, i) => <PlanRow key={ev.key} ev={ev} p={planesIn[i]} />)}
      </div>
    </div>
    <TabBar active={planes > 0.5 ? 2 : 0} />
  </div>
);

window.PA = { App };
})();
