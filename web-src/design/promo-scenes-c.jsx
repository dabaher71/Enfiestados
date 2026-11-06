(() => {
const { C, DISP, UI, cl, lerp, M, Box } = window.PC;
const { Bg, Burst } = window.PS;

const EXTRA = [
  { key:'Carrera', kicker:'DEPORTES', title:'Carrera benéfica 5K', date:'Dom 29 nov · 6:30 am', place:'Parque central, Alajuela', price:'₡8.000', day:'29', mon:'NOV', bg:'oklch(0.66 0.14 40)' },
  { key:'Galeria', kicker:'ARTE Y CULTURA', title:'Galería de arte', date:'Vie 4 dic · 6:00 pm', place:'Casa de la Cultura, Heredia', price:'Gratis', day:'04', mon:'DIC', bg:'oklch(0.9 0.03 80)' },
  { key:'Feria', kicker:'GASTRONOMÍA', title:'Feria de comida', date:'Sáb 5 dic · 11:00 am', place:'Plaza de deportes, San Carlos', price:'Gratis', day:'05', mon:'DIC', bg:'oklch(0.62 0.13 20)' },
];

/* ---------- CARRERA ---------- */
const Runner = ({ x, y, sc, shirt, skin, u, ph, num }) => {
  const t = u * 10 + ph, a = Math.sin(t) * 38, b = -Math.abs(Math.sin(t)) * 14;
  return (
    <div style={{ position:'absolute', left:x, top:y + b, width:160, height:380, transform:`scale(${sc})`, transformOrigin:'50% 100%' }}>
      <Box x={58} y={210} w={30} h={150} r={15} bg={skin} rot={a} o="top center"><Box x={-4} y={130} w={44} h={24} r={10} bg={C.ink} /></Box>
      <Box x={72} y={210} w={30} h={150} r={15} bg={skin} rot={-a} o="top center"><Box x={-4} y={130} w={44} h={24} r={10} bg={C.ink} /></Box>
      <Box x={40} y={90} w={84} h={140} r={30} bg={shirt}>
        <Box x={16} y={36} w={52} h={40} r={6} bg={C.cream} style={{ display:'flex', alignItems:'center', justifyContent:'center', fontFamily:UI, fontWeight:800, fontSize:22, color:C.ink }}>{num}</Box>
      </Box>
      <Box x={110} y={100} w={24} h={96} r={12} bg={skin} rot={-a * 0.9} o="top center" />
      <Box x={30} y={100} w={24} h={96} r={12} bg={skin} rot={a * 0.9} o="top center" />
      <Box x={50} y={10} w={68} h={76} r={34} bg={skin} />
      <Box x={44} y={26} w={80} h={14} r={7} bg={C.yellow} />
    </div>
  );
};
const Carrera = ({ u }) => {
  const confetti = M.draw(u, 1.6, 3.2);
  return (
    <Bg bg="oklch(0.86 0.08 60)">
      <Box x={760} y={120} w={160} h={160} r={80} bg={C.yellow} />
      <Box x={-200} y={560} w={800} h={500} r="50%" bg="oklch(0.74 0.12 145)" />
      <Box x={400} y={520} w={900} h={560} r="50%" bg="oklch(0.68 0.12 145)" />
      <Box x={0} y={0} w={960} h={1340} bg="#5A556E" style={{ clipPath:'polygon(42% 50%,58% 50%,100% 100%,0 100%)' }} />
      {[0, 1, 2, 3, 4].map(k => {
        const p = ((u * 0.9 + k * 0.2) % 1);
        return <Box key={k} x={480 - lerp(6, 40, p)} y={lerp(690, 1340, p * p)} w={lerp(12, 80, p)} h={lerp(16, 110, p)} r={6} bg={C.cream} />;
      })}
      <Box x={150} y={330} w={24} h={380} r={8} bg={C.ink} /><Box x={786} y={330} w={24} h={380} r={8} bg={C.ink} />
      <Box x={140} y={320} w={680} h={120} r={24} bg={C.red} style={{ display:'flex', alignItems:'center', justifyContent:'center', fontFamily:DISP, fontSize:84, color:C.cream }}>META</Box>
      <Box x={420} y={330} w={120} h={100} sc={0.45} bg={C.cream} style={{ clipPath:'path("M60 95 L10 45 A25 25 0 0 1 60 15 A25 25 0 0 1 110 45 Z")' }} />
      <Runner x={lerp(560, 600, cl(u / 3))} y={lerp(900, 840, cl(u / 3))} sc={1.15} shirt="#4FB0E8" skin="#8E5A3A" u={u} ph={1.2} num="27" />
      <Runner x={lerp(160, 260, cl(u / 3))} y={lerp(860, 800, cl(u / 3))} sc={1.35} shirt={C.yellow} skin="#C98B5E" u={u} ph={0} num="05" />
      {Array.from({ length: 18 }, (_, i) => {
        const s = Math.sin(i * 91.3) * 1e4, r = s - Math.floor(s);
        return <Box key={i} x={60 + r * 840 + Math.sin(u * 3 + i) * 30} y={lerp(280, 1200, confetti) * (0.5 + r * 0.6) - 100} w={22} h={34} r={4}
          bg={[C.yellow, C.red, C.cream, '#4FB0E8'][i % 4]} rot={u * 300 + i * 40} op={confetti > 0 ? 1 - confetti * 0.6 : 0} />;
      })}
    </Bg>
  );
};

/* ---------- GALERÍA ---------- */
const Visitor = ({ x, color, u, ph, tall = 1 }) => (
  <div style={{ position:'absolute', left:x + Math.sin(u * 0.8 + ph) * 26, top:1340 - 520 * tall, width:180, height:520 * tall }}>
    <Box x={50} y={0} w={80} h={90} r={40} bg={C.ink} />
    <Box x={20} y={100} w={140} h={520 * tall} r="70px 70px 0 0" bg={color} />
  </div>
);
const Galeria = ({ u }) => {
  const hang = M.pop(u, 0.8, 1.3), glow = M.enter(u, 1.3, 1.8);
  return (
    <Bg bg="oklch(0.94 0.02 80)">
      <Box x={0} y={1000} w={960} h={340} bg="oklch(0.78 0.05 60)" />
      <Box x={0} y={990} w={960} h={14} bg="oklch(0.7 0.05 60)" />
      {[[110, 420], [370, 300], [630, 420]].map(([x, y], k) => (
        <Box key={k} x={x} y={-20} w={220} h={k === 1 ? 900 : 1000} o="50% 0" op={k === 1 ? 0.35 + 0.65 * glow : 0.5}
          style={{ clipPath:'polygon(42% 0,58% 0,100% 100%,0 100%)', background:'linear-gradient(180deg,rgba(253,199,74,.55),rgba(253,199,74,0))' }} />
      ))}
      <Box x={90} y={420} w={260} h={330} r={10} bg="#9A5B34" rot={Math.sin(u * 1.2) * 1.5} o="50% 0">
        <Box x={18} y={18} w={224} h={294} r={4} bg="oklch(0.68 0.11 230)">
          <Box x={30} y={180} w={170} h={100} r="50%" bg="oklch(0.74 0.12 145)" /><Box x={130} y={40} w={60} h={60} r={30} bg={C.yellow} />
        </Box>
      </Box>
      <Box x={330} y={280} w={300} h={400} r={10} bg={C.ink} sc={hang} o="50% 0" rot={(1 - hang) * 8}>
        <Box x={20} y={20} w={260} h={360} r={4} bg={C.cream}>
          <Box x={30} y={40} w={140} h={140} r={70} bg={C.red} />
          <Box x={110} y={140} w={130} h={180} r={20} bg={C.yellow} rot={12 + Math.sin(u * 2) * 3} />
          <Box x={30} y={230} w={90} h={90} bg="#4FB0E8" />
        </Box>
      </Box>
      <Box x={610} y={420} w={260} h={330} r={10} bg="#9A5B34" rot={Math.sin(u * 1.2 + 2) * 1.5} o="50% 0">
        <Box x={18} y={18} w={224} h={294} r={4} bg="oklch(0.56 0.15 300)">
          <Box x={40} y={60} w={144} h={174} r="50% 50% 40% 40%" bg="#C98B5E" /><Box x={60} y={30} w={104} h={70} r="50px 50px 10px 10px" bg={C.ink} />
        </Box>
      </Box>
      <Box x={390} y={710} w={180} h={50} r={8} bg={C.cream} op={glow} style={{ display:'flex', alignItems:'center', justifyContent:'center', fontFamily:UI, fontWeight:800, fontSize:20, color:C.ink, border:`2px solid ${C.line}` }}>NUEVA OBRA</Box>
      <Visitor x={90} color="#4A4562" u={u} ph={0} tall={0.92} />
      <Visitor x={660} color={C.red} u={u} ph={2} />
    </Bg>
  );
};

/* ---------- FERIA ---------- */
const Feria = ({ u }) => {
  const sk = k => M.pop(u, 0.8 + k * 0.15, 1.15 + k * 0.15);
  return (
    <Bg bg="oklch(0.36 0.06 280)">
      <Box x={0} y={160} w={960} h={4} bg="rgba(251,250,247,.4)" />
      {Array.from({ length: 12 }, (_, i) => <Box key={i} x={i * 84 + 20} y={156 + Math.sin(i * 0.9) * 20} w={30} h={30} r={15} bg={[C.yellow, C.red, '#7BC67B'][i % 3]} op={0.55 + 0.45 * Math.sin(u * 6 + i)} />)}
      <Box x={0} y={1060} w={960} h={280} bg="#2B2640" />
      <Box x={100} y={420} w={760} h={160} style={{ background:`repeating-linear-gradient(90deg,${C.red} 0 95px,${C.cream} 95px 190px)`, clipPath:'polygon(4% 0,96% 0,100% 100%,0 100%)' }} />
      {Array.from({ length: 8 }, (_, i) => <Box key={i} x={100 + i * 95} y={560} w={95} h={50} r="0 0 48px 48px" bg={i % 2 ? C.cream : C.red} />)}
      <Box x={130} y={600} w={24} h={460} bg="#7A4626" /><Box x={806} y={600} w={24} h={460} bg="#7A4626" />
      <Box x={110} y={300} w={740} h={110} r={55} bg={C.yellow} style={{ display:'flex', alignItems:'center', justifyContent:'center', fontFamily:DISP, fontSize:64, color:C.ink }}>¡Qué rico!</Box>
      <Box x={110} y={860} w={740} h={200} r={20} bg="#9A5B34" />
      <Box x={200} y={740} w={240} h={140} r="0 0 110px 110px" bg="#4A4562" />
      <Box x={180} y={730} w={280} h={30} r={15} bg="#5E5A70" />
      {[0, 1, 2].map(k => {
        const p = ((u * 0.7 + k * 0.33) % 1);
        return <Box key={k} x={260 + k * 50 + Math.sin(p * 8 + k) * 20} y={lerp(700, 480, p)} w={40} h={90} r={20} bg="rgba(251,250,247,.7)" op={Math.sin(p * Math.PI) * 0.8} />;
      })}
      {[0, 1, 2].map(k => (
        <Box key={k} x={520 + k * 90} y={720} w={20} h={160} sc={sk(k)} o="50% 100%" bg="transparent">
          <Box x={8} y={40} w={4} h={120} bg={C.cream} />
          <Box x={-10} y={0} w={40} h={36} r={10} bg="#B7793F" /><Box x={-10} y={40} w={40} h={30} r={10} bg="#7BC67B" /><Box x={-10} y={74} w={40} h={36} r={10} bg="#B7793F" />
        </Box>
      ))}
      <Box x={380} y={1100} w={200} h={70} r={35} bg={C.yellow} sc={M.pop(u, 1.5, 1.85)}
        style={{ display:'flex', alignItems:'center', justifyContent:'center', fontFamily:UI, fontWeight:800, fontSize:34, color:C.ink, boxShadow:`0 6px 0 ${C.ink}` }}>₡2.500</Box>
    </Bg>
  );
};

window.PS = Object.assign(window.PS, { Carrera, Galeria, Feria });
window.PC.EXTRA = EXTRA;
})();
