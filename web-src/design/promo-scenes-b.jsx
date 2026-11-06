(() => {
const { C, DISP, UI, cl, lerp, M, Box } = window.PC;
const { Bg, Burst } = window.PS;

/* ---------- CONCIERTO ---------- */
const Person = ({ x, y, shirt, skin = '#C98B5E', u, ph = 0, children }) => {
  const b = Math.sin(u * 8 + ph) * 6;
  return (
    <div style={{ position:'absolute', left:x, top:y + b, width:200, height:420 }}>
      <Box x={62} y={250} w={34} h={170} r={17} bg="#4A4562" /><Box x={104} y={250} w={34} h={170} r={17} bg="#4A4562" />
      <Box x={50} y={90} w={100} h={180} r={40} bg={shirt} />
      <Box x={66} y={0} w={70} h={80} r={35} bg={skin} />
      <Box x={60} y={-8} w={82} h={36} r="40px 40px 10px 10px" bg={C.ink} />
      {children}
    </div>
  );
};
const Concierto = ({ u }) => {
  const on = u < 0.85 ? 0 : (u < 0.95 ? 1 : u < 1.02 ? 0.3 : 1);
  const crowd = Array.from({ length: 7 }, (_, i) => i);
  return (
    <Bg bg="#2B2640">
      <Box x={0} y={0} w={960} h={900} style={{ background:'repeating-linear-gradient(0deg,#332D4B 0 58px,#2B2640 58px 64px)' }} />
      <div style={{ position:'absolute', left:0, right:0, top:110, textAlign:'center', fontFamily:DISP, fontSize:170, lineHeight:1, color:'#FFD9EA', opacity:0.25 + 0.75 * on,
        textShadow: on ? '0 0 18px #FF5FA8, 0 0 48px #FF5FA8, 0 0 90px #FF3D8E' : 'none' }}>BAR</div>
      <div style={{ position:'absolute', left:0, right:0, top:300, textAlign:'center', fontFamily:UI, fontWeight:800, fontSize:40, letterSpacing:'0.3em', color:C.yellow, opacity:on,
        textShadow:`0 0 20px ${C.yellow}` }}>EN VIVO</div>
      {[0, 1].map(k => (
        <Box key={k} x={k ? 470 : -10} y={-40} w={500} h={1000} rot={(k ? -1 : 1) * (14 + Math.sin(u * 2.2 + k * 2) * 10)} o="50% 0"
          style={{ clipPath:'polygon(44% 0,56% 0,100% 100%,0 100%)', background:'linear-gradient(180deg, rgba(253,199,74,.55), rgba(253,199,74,0))', opacity:on }} />
      ))}
      <Box x={0} y={880} w={960} h={60} bg="#4A4562" /><Box x={0} y={940} w={960} h={30} bg="#1F1C2C" />
      <Person x={180} y={470} shirt={C.yellow} u={u}>
        <Box x={140} y={40} w={10} h={420} r={5} bg={C.cream} />
        <Box x={128} y={30} w={34} h={44} r={17} bg="#8F8AA3" />
        <Box x={128} y={110} w={26} h={110} r={13} bg={C.yellow} rot={-130 + Math.sin(u * 8) * 6} o="top center" />
      </Person>
      <Person x={560} y={470} shirt={C.red} skin="#8E5A3A" u={u} ph={1.4}>
        <Box x={10} y={150} w={240} h={22} r={8} bg="#6B3E22" rot={-24} o="20% 50%" />
        <Box x={20} y={150} w={120} h={100} r="50%" bg="#E9B872" rot={-24} />
        <Box x={56} y={186} w={28} h={28} r={14} bg={C.ink} />
      </Person>
      {[0, 1, 2, 3, 4].map(k => {
        const t = ((u * 0.9 + k * 0.32) % 1.6) / 1.6;
        return <div key={k} style={{ position:'absolute', left:260 + k * 110 + Math.sin(t * 9 + k) * 30, top:lerp(640, 340, t), fontSize:80, color:k % 2 ? C.cream : C.yellow,
          opacity:Math.sin(t * Math.PI) * on, fontFamily:UI }}>{k % 2 ? '♫' : '♪'}</div>;
      })}
      {crowd.map(i => {
        const b = Math.abs(Math.sin(u * 7 + i * 1.3)) * 30, up = i % 2 === 0;
        return (
          <div key={i} style={{ position:'absolute', left:-40 + i * 150, top:1080 - b, width:180, height:400 }}>
            {up && <Box x={136} y={-140} w={30} h={170} r={15} bg="#14121F" rot={14} o="bottom center" />}
            <Box x={45} y={0} w={92} h={100} r={46} bg="#14121F" />
            <Box x={10} y={90} w={160} h={260} r="80px 80px 0 0" bg="#14121F" />
          </div>
        );
      })}
    </Bg>
  );
};

/* ---------- GARAGE ---------- */
const Tag = ({ x, y, text, u, ph }) => (
  <Box x={x} y={y} w={150} h={60} r={12} bg={C.yellow} rot={Math.sin(u * 4 + ph) * 8} o="50% -40px"
    style={{ display:'flex', alignItems:'center', justifyContent:'center', fontFamily:UI, fontWeight:800, fontSize:30, color:C.ink, boxShadow:`0 6px 0 ${C.ink}` }}>{text}</Box>
);
const Garage = ({ u }) => {
  const open = M.enter(u, 0.75, 1.35);
  const it = k => M.pop(u, 1.25 + k * 0.13, 1.6 + k * 0.13);
  return (
    <Bg bg="oklch(0.82 0.08 200)">
      <Box x={-100} y={760} w={1160} h={300} r="50%" bg="oklch(0.64 0.12 150)" />
      <Box x={120} y={300} w={720} h={640} bg={C.cream} />
      <Box x={70} y={110} w={820} h={220} bg={C.red} style={{ clipPath:'polygon(50% 0,100% 100%,0 100%)' }} />
      <Box x={420} y={180} w={120} h={110} r={60} bg={C.yellow} />
      <Box x={210} y={460} w={540} h={480} bg="#3A3552">
        <Box x={40} y={300} w={140} h={120} r={10} bg="#B7793F" /><Box x={60} y={220} w={100} h={80} r={10} bg="#C98F4A" />
        <Box x={360} y={260} w={130} h={160} r={10} bg="#7BC67B" />
      </Box>
      <Box x={210} y={460} w={540} h={480 * (1 - open)} style={{ background:'repeating-linear-gradient(180deg,#E7E1D6 0 54px,#CFC7B8 54px 60px)' }} />
      <Box x={0} y={940} w={960} h={400} bg="#D9D2C3" />
      <Box x={130} y={1040} w={700} h={34} r={10} bg="#9A5B34" />
      <Box x={170} y={1070} w={26} h={200} bg="#7A4626" /><Box x={764} y={1070} w={26} h={200} bg="#7A4626" />
      <Box x={180} y={860} w={150} h={180} sc={it(0)} o="50% 100%">
        <Box x={20} y={0} w={110} h={80} bg={C.yellow} style={{ clipPath:'polygon(20% 0,80% 0,100% 100%,0 100%)' }} />
        <Box x={68} y={80} w={14} h={80} bg={C.ink} /><Box x={35} y={160} w={80} h={20} r={8} bg={C.ink} />
      </Box>
      <Box x={360} y={930} w={160} h={110} sc={it(1)} o="50% 100%">
        <Box x={0} y={70} w={160} h={40} r={6} bg={C.blue} /><Box x={10} y={36} w={140} h={36} r={6} bg={C.red} /><Box x={22} y={0} w={120} h={38} r={6} bg="#7BC67B" />
      </Box>
      <Box x={560} y={880} w={220} h={160} sc={it(2)} o="50% 100%">
        <Box x={0} y={20} w={220} h={140} r={24} bg="#F28C3C" />
        <Box x={120} y={50} w={80} h={80} r={40} bg={C.ink} /><Box x={140} y={70} w={40} h={40} r={20} bg="#8F8AA3" />
        <Box x={24} y={56} w={70} h={14} r={7} bg={C.cream} /><Box x={24} y={86} w={70} h={14} r={7} bg={C.cream} />
        <Box x={150} y={-30} w={8} h={60} r={4} bg={C.ink} rot={30} />
      </Box>
      <div style={{ opacity:cl(it(3)) }}>
        <Tag x={190} y={1110} text="₡1.000" u={u} ph={0} />
        <Tag x={400} y={1110} text="₡500" u={u} ph={1.2} />
        <Tag x={610} y={1110} text="₡3.000" u={u} ph={2.4} />
      </div>
      <Box x={40} y={560} w={300} h={0} sc={M.pop(u, 0.95, 1.3)} o="50% 100%">
        <Box x={135} y={140} w={30} h={260} bg="#7A4626" />
        <Box x={0} y={0} w={300} h={170} r={22} bg={C.cream} style={{ border:`8px solid ${C.ink}`, boxSizing:'border-box', display:'flex', alignItems:'center', justifyContent:'center',
          textAlign:'center', fontFamily:DISP, fontSize:50, lineHeight:1, color:C.red }}>Venta de garage</Box>
      </Box>
    </Bg>
  );
};

window.PS = Object.assign(window.PS, { Concierto, Garage });
})();
