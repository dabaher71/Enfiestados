(() => {
const { useRef, useState, useEffect } = React;
const { C, UI, DISP, lerp, M, Box, EVENTS, PHONE, SCREEN, S, SceneView, Stub, Icon, IC } = window.PC;
const PS = window.PS, { App } = window.PA;
const ALL = EVENTS.map(() => 1);

function useLive(offset = 0, animate = true) {
  const ref = useRef(null);
  const [s, setS] = useState({ t: offset + 1.6, w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let vis = true, raf, start = performance.now() - offset * 1000;
    const still = !animate || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const measure = () => setS(p => ({ ...p, w: el.clientWidth, h: el.clientHeight }));
    const ro = new ResizeObserver(measure); ro.observe(el); measure();
    const io = new IntersectionObserver(([e]) => { vis = e.isIntersecting; }); io.observe(el);
    const loop = now => { raf = requestAnimationFrame(loop); if (vis && !still) setS(p => ({ ...p, t: (now - start) / 1000 })); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, [animate]);
  return [ref, s];
}

const Btn = ({ on, label }) => (
  <div style={{ height:44, padding:'0 22px', borderRadius:22, background:on ? C.ink : C.yellow, color:on ? C.yellow : C.ink, display:'flex', alignItems:'center', gap:6, fontSize:16, fontWeight:800 }}>
    {on && <Icon {...IC.check} size={18} color={C.yellow} />}{label}
  </div>
);

const FeedOverlay = ({ t }) => {
  const D = 4.2, n = EVENTS.length, cyc = t % (D * n), i = Math.floor(cyc / D), lt = cyc - i * D;
  const prev = (i === 0 ? n - 1 : i - 1) * 446;
  const scroll = lerp(prev, i * 446, M.enter(lt, 0, 0.6));
  const done = EVENTS.map((_, j) => j < i || (j === i && lt > 3.6));
  const p = M.enter(lt, 0.85, 1.3), c = M.enter(lt, 3.5, 3.95), f = p * (1 - c);
  const r = { x:lerp(20, 0, f), y:lerp(268, 0, f), w:lerp(350, 390, f), h:lerp(270, 821, f) };
  const a = M.pop(lt, 0.55, 0.75), fade = 1 - M.enter(lt, 0.85, 1.0), panel = M.draw(lt, 1.3, 1.6) * (1 - c);
  const ev = EVENTS[i], Sc = PS[ev.key], voy = lt > 3.0, vp = M.pop(lt, 3.0, 3.2);
  return (
    <>
      <App scroll={scroll} done={done} hideIdx={p > 0 ? i : -1} planes={0} planesIn={ALL} />
      <Box x={195 - 26} y={403 - 26} w={52} h={52} r={26} bg="rgba(251,250,247,.85)" sc={a} op={fade} style={{ border:`3px solid ${C.ink}`, boxSizing:'border-box' }} />
      {p > 0 && <SceneView rect={r} r={lerp(16, 0, f)}><Sc u={lt - 0.5} /></SceneView>}
      {panel > 0 && (
        <div style={{ position:'absolute', left:14, right:14, bottom:22, borderRadius:22, background:C.cream, padding:'16px 18px', display:'flex', alignItems:'center', gap:12, fontFamily:UI,
          opacity:panel, transform:`translateY(${(1 - panel) * 30}px)`, boxShadow:'0 10px 30px rgba(31,28,44,.25)' }}>
          <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:2 }}>
            <div style={{ fontSize:11, fontWeight:800, letterSpacing:'0.14em', color:C.gold }}>{ev.kicker}</div>
            <div style={{ fontSize:18, fontWeight:800, color:C.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ev.title}</div>
            <div style={{ fontSize:13, fontWeight:600, color:C.gray }}>{ev.date}</div>
          </div>
          <div style={{ transform:`scale(${voy ? 0.9 + 0.1 * vp : 1})` }}><Btn on={voy} label="Voy" /></div>
        </div>
      )}
    </>
  );
};

const DetailScreen = ({ t }) => {
  const D = 3.6, i = Math.floor(t / D) % EVENTS.length, lt = t % D, ev = EVENTS[i], Sc = PS[ev.key];
  const o = M.draw(lt, 0, 0.35) * (1 - M.enter(lt, D - 0.3, D));
  const voy = lt > 2.4, vp = M.pop(lt, 2.4, 2.6);
  return (
    <div style={{ position:'absolute', left:0, top:0, width:390, height:821, background:C.cream, overflow:'hidden', fontFamily:UI, color:C.ink }}>
      <div style={{ opacity:o }}><SceneView rect={{ x:0, y:0, w:390, h:480 }} r={0}><Sc u={lt + 0.4} /></SceneView></div>
      <div style={{ position:'absolute', left:16, top:56, width:40, height:40, borderRadius:20, background:'rgba(251,250,247,.92)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:800 }}>‹</div>
      <div style={{ position:'absolute', left:0, right:0, top:448, bottom:0, background:C.cream, borderRadius:'28px 28px 0 0', padding:'26px 22px', display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ opacity:o, display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ fontSize:12, fontWeight:800, letterSpacing:'0.14em', color:C.gold }}>{ev.kicker}</div>
          <div style={{ fontFamily:DISP, fontSize:32, lineHeight:1.05 }}>{ev.title}</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:15, fontWeight:700 }}><Icon {...IC.cal} size={18} color="#E9A800" />{ev.date}</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:15, fontWeight:500, color:C.gray }}><Icon {...IC.pin} size={18} color={C.gray} />{ev.place}</div>
        </div>
        <div style={{ position:'absolute', left:22, right:22, bottom:34, display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ flex:1, fontSize:24, fontWeight:800, opacity:o }}>{ev.price}</div>
          <div style={{ width:44, height:44, borderRadius:22, border:`1.5px solid ${C.line}`, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon {...IC.heart} size={20} color={C.ink} /></div>
          <div style={{ transform:`scale(${voy ? 0.9 + 0.1 * vp : 1})` }}><Btn on={voy} label="Voy" /></div>
        </div>
      </div>
    </div>
  );
};

const LivePhone = ({ mode = 'feed', offset = 0, animate = true }) => {
  const [ref, { t, w }] = useLive(offset, animate);
  const k = w / PHONE.w;
  let screen;
  if (mode === 'feed') screen = <FeedOverlay t={t} />;
  else if (mode === 'detail') screen = <DetailScreen t={t} />;
  else {
    const cyc = t % 5.6, out = 1 - M.enter(cyc, 5.1, 5.5);
    screen = <App scroll={0} done={ALL} hideIdx={-1} planes={1} planesIn={EVENTS.map((_, j) => M.pop(cyc, 0.3 + j * 0.15, 0.65 + j * 0.15) * out)} />;
  }
  return (
    <div ref={ref} style={{ position:'relative', width:'100%', aspectRatio:`${PHONE.w} / ${PHONE.h}` }}>
      {w > 0 && (
        <div style={{ position:'absolute', left:0, top:0, width:PHONE.w, height:PHONE.h, transform:`scale(${k})`, transformOrigin:'0 0' }}>
          <div style={{ position:'absolute', inset:0, borderRadius:120, background:C.ink, boxShadow:'0 50px 90px rgba(31,28,44,.22)' }}></div>
          <div style={{ position:'absolute', left:20, top:20, width:SCREEN.w, height:SCREEN.h, borderRadius:100, overflow:'hidden', background:C.cream }}>
            <div style={{ position:'absolute', left:0, top:0, width:390, height:821, transform:`scale(${S})`, transformOrigin:'0 0' }}>{screen}</div>
          </div>
          <div style={{ position:'absolute', left:PHONE.w / 2 - 110, top:42, width:220, height:62, borderRadius:31, background:'#000' }}></div>
        </div>
      )}
    </div>
  );
};

const LiveTicket = ({ idx = 0, offset = 0, notch = C.cream, animate = true }) => {
  const [ref, { t, w }] = useLive(offset, animate);
  const ev = idx < EVENTS.length ? EVENTS[idx] : window.PC.EXTRA[idx - EVENTS.length], Sc = PS[ev.key], u = t % 3.6, k = w / 960;
  return (
    <div ref={ref} style={{ position:'relative', width:'100%', aspectRatio:'960 / 1660' }}>
      {w > 0 && (
        <div style={{ position:'absolute', left:0, top:0, width:960, height:1660, transform:`scale(${k})`, transformOrigin:'0 0', filter:'drop-shadow(0 30px 40px rgba(31,28,44,.25))' }}>
          <div style={{ position:'absolute', left:0, top:0, width:960, height:1340, borderRadius:'56px 56px 0 0', overflow:'hidden' }}><Sc u={u} /></div>
          <div style={{ position:'absolute', left:0, top:1340 }}><Stub ev={ev} stamp={M.pop(u, 2.2, 2.55)} bgNotch={notch} /></div>
        </div>
      )}
    </div>
  );
};

window.EW = { LivePhone, LiveTicket };
})();
