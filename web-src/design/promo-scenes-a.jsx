(() => {
const { C, DISP, UI, cl, lerp, M, Box } = window.PC;
const Bg = ({ bg, children }) => <div style={{ position:'absolute', inset:0, background:bg, overflow:'hidden' }}>{children}</div>;
const Burst = ({ text, u, at, y, color = C.yellow }) => {
  const p = M.pop(u, at, at + 0.35);
  return (
    <div style={{ position:'absolute', left:0, right:0, top:y, textAlign:'center', fontFamily:DISP, fontSize:170, color, lineHeight:1,
      textShadow:`0 12px 0 ${C.ink}`, WebkitTextStroke:`6px ${C.ink}`, paintOrder:'stroke fill',
      transform:`rotate(${-6 + Math.sin(u * 6) * 1.5}deg) scale(${p})`, opacity: p > 0 ? 1 : 0 }}>{text}</div>
  );
};

/* ---------- TOPE ---------- */
const Horse = ({ x, y, sc, color, mane, shirt, u, ph }) => {
  const t = u * 9 + ph, a = Math.sin(t) * 22, bob = -Math.abs(Math.sin(t)) * 16;
  const leg = (lx, rot) => (
    <Box x={lx} y={195} w={28} h={130} r={14} bg={color} rot={rot} o="top center">
      <Box x={0} y={108} w={28} h={24} r={8} bg={C.ink} />
    </Box>
  );
  return (
    <div style={{ position:'absolute', left:x, top:y + bob, width:420, height:340, transform:`scale(${sc})`, transformOrigin:'0 100%' }}>
      <Box x={52} y={128} w={46} h={120} r="23px 23px 23px 40px" bg={mane} rot={22 + Math.sin(t) * 8} o="top center" />
      {leg(90, -a)}{leg(124, a)}
      <Box x={60} y={110} w={275} h={122} r={61} bg={color} />
      {leg(252, a)}{leg(288, -a)}
      <Box x={258} y={20} w={82} h={170} r={41} bg={color} rot={28} o="bottom center" />
      <Box x={262} y={12} w={28} h={150} r={14} bg={mane} rot={28} o="bottom center" />
      <Box x={318} y={-12} w={22} h={36} r={11} bg={color} rot={18} />
      <Box x={300} y={0} w={126} h={66} r={33} bg={color} rot={24} />
      <Box x={362} y={24} w={12} h={12} r={6} bg={C.ink} />
      <Box x={186} y={88} w={30} h={96} r={15} bg="#33427A" rot={-8} />
      <Box x={160} y={-12} w={78} h={118} r={32} bg={shirt} />
      <Box x={214} y={10} w={26} h={86} r={13} bg={shirt} rot={-60} o="top center" />
      <Box x={168} y={-74} w={62} h={62} r={31} bg="#C98B5E" />
      <Box x={136} y={-80} w={126} h={24} r={12} bg={C.cream} />
      <Box x={166} y={-118} w={66} h={50} r="33px 33px 8px 8px" bg={C.cream} />
      <Box x={166} y={-82} w={66} h={10} r={4} bg={C.ink} />
    </div>
  );
};
const Tope = ({ u }) => {
  const cam = 1.04 + 0.06 * cl(u / 3.2);
  return (
    <Bg bg="oklch(0.85 0.07 225)">
      <div style={{ position:'absolute', inset:0, transform:`scale(${cam})`, transformOrigin:'50% 70%' }}>
        <Box x={640} y={150 - u * 10} w={220} h={220} r={110} bg={C.yellow} />
        <Box x={-260} y={780} w={900} h={640} r="50%" bg="oklch(0.74 0.12 145)" />
        <Box x={380} y={720} w={980} h={720} r="50%" bg="oklch(0.68 0.12 145)" />
        <Box x={0} y={1060} w={960} h={290} bg="#E8C98F" />
        <Box x={0} y={1180} w={960} h={10} bg="#D4AE6E" />
        <Box x={0} y={206} w={960} h={4} bg="rgba(31,28,44,.35)" />
        {Array.from({ length: 10 }, (_, i) => (
          <Box key={i} x={i * 100 + 10} y={208} w={74} h={88} bg={[C.red, C.cream, C.blue][i % 3]}
            rot={Math.sin(u * 3 + i) * 7} o="top center" style={{ clipPath:'polygon(0 0,100% 0,50% 100%)' }} />
        ))}
        <Horse x={lerp(-330, 80, cl((u - 0.3) / 2.9))} y={740} sc={0.95} color="#3A2A24" mane={C.ink} shirt={C.red} u={u} ph={1.6} />
        <Horse x={lerp(140, 540, cl((u - 0.3) / 2.9))} y={800} sc={1.15} color="#9A5B34" mane="#3A2A24" shirt={C.yellow} u={u} ph={0} />
      </div>
    </Bg>
  );
};

/* ---------- BINGO ---------- */
const BALLC = [C.yellow, C.red, C.cream, '#4FB0E8', '#7BC67B', '#F28C3C', C.cream, C.yellow];
const Bingo = ({ u }) => {
  const pop = M.pop(u, 0.95, 1.4), gone = M.enter(u, 1.95, 2.2);
  const bx = lerp(480, 760, pop), by = lerp(330, 640, pop), bs = lerp(0.3, 1, pop) * (1 - gone);
  const nums = [[3, 18, 33, 52, 64], [7, 21, 'E', 49, 70], [12, 26, 41, 57, 68], [1, 29, 38, 46, 61]];
  return (
    <Bg bg="oklch(0.56 0.15 300)">
      {[0, 1].map(k => <Box key={k} x={480 + (k ? 80 : -110)} y={480} w={30} h={190} r={15} bg={C.cream} rot={k ? -18 : 18} o="top center" />)}
      <Box x={300} y={650} w={360} h={34} r={17} bg={C.cream} />
      {BALLC.map((c, k) => {
        const a = k * 0.785 + u * 2.6, rr = 70 + (k % 3) * 45;
        return <Box key={k} x={480 + Math.cos(a) * rr - 30} y={330 + Math.sin(a) * rr * 0.9 - 30} w={60} h={60} r={30} bg={c} />;
      })}
      <Box x={250} y={100} w={460} h={460} r={230} style={{ border:`14px solid ${C.cream}`, boxSizing:'border-box' }} />
      {[0, 1, 2, 3].map(k => <Box key={k} x={260} y={326} w={440} h={8} r={4} bg="rgba(251,250,247,.7)" rot={u * 140 + k * 45} />)}
      <Box x={455} y={305} w={50} h={50} r={25} bg={C.cream} />
      <Box x={150} y={790} w={660} h={500} r={40} bg={C.cream} style={{ boxShadow:`0 16px 0 ${C.ink}` }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', padding:'26px 34px 0', fontFamily:DISP, fontSize:70, color:C.ink, textAlign:'center' }}>
          {'BINGO'.split('').map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gridAutoRows:84, padding:'6px 34px', fontFamily:UI, fontWeight:800, fontSize:40, color:C.gray }}>
          {nums.flat().map((n, i) => {
            const row = Math.floor(i / 5), col = i % 5, d = row === 1 ? M.pop(u, 1.3 + col * 0.11, 1.55 + col * 0.11) : 0;
            return (
              <div key={i} style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ position:'absolute', width:76, height:76, borderRadius:38, background:C.yellow, transform:`scale(${d})` }}></div>
                <span style={{ position:'relative', color: d > 0.5 ? C.ink : C.gray }}>{n === 'E' ? '★' : n}</span>
              </div>
            );
          })}
        </div>
      </Box>
      <div style={{ position:'absolute', left:bx - 95, top:by - 95, width:190, height:190, borderRadius:95, background:C.yellow, transform:`scale(${bs}) rotate(${(1 - pop) * -200}deg)`,
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:120, height:120, borderRadius:60, background:C.cream, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:UI, fontWeight:800, color:C.ink, lineHeight:1 }}>
          <span style={{ fontSize:24 }}>B</span><span style={{ fontSize:56 }}>7</span>
        </div>
      </div>
      <Burst text="¡Bingo!" u={u} at={2.05} y={560} />
    </Bg>
  );
};

/* ---------- BOLOS ---------- */
const PINS = [[0, 0], [-1, 1], [1, 1], [-2, 2], [0, 2], [2, 2], [-3, 3], [-1, 3], [1, 3], [3, 3]];
const Bolos = ({ u }) => {
  const roll = M.enter(u, 0.75, 1.75), hit = cl((u - 1.75) / 0.8);
  const by = lerp(1250, 430, roll), bsz = lerp(240, 84, roll);
  return (
    <Bg bg="oklch(0.6 0.11 195)">
      <Box x={0} y={0} w={960} h={400} bg="oklch(0.44 0.08 200)" />
      {Array.from({ length: 8 }, (_, i) => <Box key={i} x={70 + i * 115} y={70} w={46} h={46} r={23} bg={C.yellow} op={0.6 + 0.4 * Math.sin(u * 8 + i)} />)}
      <Box x={0} y={0} w={960} h={1340} bg="oklch(0.36 0.06 200)" style={{ clipPath:'polygon(35% 26%,65% 26%,100% 100%,0 100%)' }} />
      <Box x={0} y={0} w={960} h={1340} bg="#E9B872" style={{ clipPath:'polygon(38.5% 26%,61.5% 26%,92% 100%,8% 100%)' }} />
      {[-2, -1, 0, 1, 2].map(k => <Box key={k} x={480 + k * 60 - 14} y={1000} w={28} h={40} bg="#C98F4A" style={{ clipPath:'polygon(50% 0,100% 100%,0 100%)' }} />)}
      {PINS.map(([cx, row], i) => {
        const px = 480 + cx * 30, py = 420 - row * 30;
        const seed = Math.sin(i * 12.9898) * 43758.5453, rnd = seed - Math.floor(seed);
        const vx = (cx * 160 + (rnd - 0.5) * 300) * hit, vy = (-420 - rnd * 300) * hit + 900 * hit * hit;
        const rot = (cx || (rnd - 0.5)) * 520 * hit;
        return (
          <Box key={i} x={px - 18 + vx} y={py - 92 + vy} w={36} h={96} bg={C.cream} rot={rot} o="50% 70%"
            r="50% 50% 45% 45% / 32% 32% 68% 68%" op={1 - cl((hit - 0.7) / 0.3)}>
            <Box x={0} y={24} w={36} h={7} bg={C.red} /><Box x={0} y={35} w={36} h={7} bg={C.red} />
          </Box>
        );
      })}
      <Box x={480 - 90} y={330} w={180} h={180} r={90} style={{ border:`10px solid ${C.cream}`, boxSizing:'border-box' }}
        sc={0.3 + hit * 2.6} op={hit > 0 ? 1 - hit : 0} />
      <div style={{ position:'absolute', left:480 - bsz / 2, top:by - bsz / 2, width:bsz, height:bsz, borderRadius:'50%', background:C.ink, opacity: hit > 0.05 ? 0 : 1, transform:`rotate(${roll * 720}deg)` }}>
        {[[30, 28], [52, 24], [40, 46]].map(([fx, fy], k) => <div key={k} style={{ position:'absolute', left:`${fx}%`, top:`${fy}%`, width:'13%', height:'13%', borderRadius:'50%', background:'#4A4562' }}></div>)}
      </div>
      <Burst text="¡Chuza!" u={u} at={1.95} y={600} />
    </Bg>
  );
};

window.PS = Object.assign(window.PS || {}, { Tope, Bingo, Bolos, Bg, Burst });
})();
