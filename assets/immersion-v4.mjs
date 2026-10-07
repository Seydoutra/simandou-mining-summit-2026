/**
 * Simandou immersive layer v4 — runs inside the existing R3F canvas.
 * Realistic scroll-driven heavy-haul train, railway, atmosphere, camera rig
 * and a cinematic post-processing pass (bloom, aberration, grain, vignette).
 */
export function createImmersionV4(React, useFrame, T) {
 const h = React.createElement;
 const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
 const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
 const UP = new T.Vector3(0, 1, 0);

 // Shared live state, written once per frame by the Railway (priority -1).
 const live = { frames: 0, first: 0, time: 0, velocity: 0, speed: 0, head: new T.Vector3(), headDir: new T.Vector3(1, 0, 0), pointer: { x: 0, y: 0, tx: 0, ty: 0 } };
 if (typeof window !== 'undefined') window.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; live.pointer.tx = e.clientX / innerWidth * 2 - 1; live.pointer.ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });
 const shared = { uTime: { value: 0 }, uScan: { value: -20 }, uVelocity: { value: 0 } };

 /* ---------- geometry helpers ---------- */
 function part(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (geo !== g) geo.dispose();
  g.deleteAttribute('uv');
  const m = new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
 }
 const box = (w, hh, d, x, y, z, rx, ry, rz) => part(new T.BoxGeometry(w, hh, d), x, y, z, rx, ry, rz);
 const cyl = (r1, r2, hh, s, x, y, z, rx = 0, ry = 0, rz = 0) => part(new T.CylinderGeometry(r1, r2, hh, s), x, y, z, rx, ry, rz);
 function merge(list) {
  let n = 0; list.forEach(g => n += g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  list.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); });
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3));
  out.computeBoundingSphere(); return out;
 }
 let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647, (seed - 1) / 2147483646);

 /* ---------- materials ---------- */
 function makeMaterials() {
  return {
   paint: new T.MeshStandardMaterial({ color: '#2f63ff', metalness: .35, roughness: .3, emissive: '#0c2a9a', emissiveIntensity: .55 }),
   cyan: new T.MeshStandardMaterial({ color: '#2ee0ee', metalness: .3, roughness: .28, emissive: '#18c8d8', emissiveIntensity: 1.25 }),
   dark: new T.MeshStandardMaterial({ color: '#16242a', metalness: .7, roughness: .45 }),
   steel: new T.MeshStandardMaterial({ color: '#a9b6ba', metalness: .95, roughness: .26 }),
   rail: new T.MeshStandardMaterial({ color: '#c3ccd0', metalness: 1, roughness: .22, emissive: '#3a2412', emissiveIntensity: .35 }),
   rail2: new T.MeshStandardMaterial({ color: '#8d989c', metalness: 1, roughness: .3 }),
   glass: new T.MeshStandardMaterial({ color: '#06141c', metalness: .9, roughness: .05, emissive: '#5fe6ff', emissiveIntensity: .55 }),
   lamp: new T.MeshBasicMaterial({ color: new T.Color(4, 3.6, 2.6), toneMapped: false }),
   red: new T.MeshBasicMaterial({ color: new T.Color(3.5, .15, .1), toneMapped: false }),
   ore: new T.MeshStandardMaterial({ color: '#a2482a', metalness: .4, roughness: .7, flatShading: true, emissive: '#2a0c04', emissiveIntensity: .6 }),
   sleeper: new T.MeshStandardMaterial({ color: '#59615f', roughness: .9, metalness: .05 }),
   ballast: new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true }),
  };
 }

 /* ---------- rolling stock ---------- */
 // Local frame: +x forward, +y up, origin on rail head between the rails. 1 m ≈ 0.2 u.
 const LOCO_L = 4.4, WAGON_L = 2.06, GAP = .1;
 function buildLoco() {
  const paint = [], cyan = [], dark = [], steel = [], glass = [], lamp = [];
  paint.push(box(3.15, .56, .5, -.52, .66, 0));              // long hood
  paint.push(box(.82, .8, .6, 1.5, .76, 0));                  // cab
  paint.push(box(.36, .42, .6, 2.08, .57, 0));                // nose
  paint.push(box(.3, .1, .56, 2.0, .83, 0, 0, 0, -.5));       // nose bevel
  cyan.push(box(4.32, .07, .615, 0, .4, 0));                   // livery band
  cyan.push(box(.84, .05, .605, 1.5, 1.05, 0));                // cab crown stripe
  cyan.push(box(.06, .44, .615, -2.12, .66, 0));               // rear edge
  dark.push(box(4.4, .13, .5, 0, .3, 0));                      // underframe
  dark.push(box(4.4, .035, .66, 0, .375, 0));                  // walkway
  dark.push(box(1.35, .18, .44, 0, .16, 0));                   // fuel tank
  dark.push(box(.88, .06, .64, 1.5, 1.18, 0));                 // cab roof
  dark.push(box(.2, .07, .09, 2.32, .24, 0), box(.2, .07, .09, -2.32, .24, 0)); // couplers
  dark.push(box(.12, .1, .5, 2.24, .18, 0));                   // pilot / snowplough
  [-1.62, -1.2, -.78].forEach(x => { dark.push(cyl(.13, .13, .05, 18, x, .96, 0)); steel.push(cyl(.04, .04, .055, 8, x, .965, 0)); }); // radiator fans
  dark.push(box(.16, .12, .12, .3, 1.0, 0));                   // exhaust stack
  dark.push(box(1.2, .06, .3, -.3, .965, 0));                  // roof hatch
  for (let x = -1.9; x <= .9; x += .32) [-1, 1].forEach(s => dark.push(box(.22, .26, .006, x, .7, s * .252))); // louvres
  [-1, 1].forEach(s => {
   steel.push(box(3.6, .018, .018, -.35, .64, s * .325));      // handrail
   for (let x = -2.1; x <= 1.2; x += .45) steel.push(box(.016, .26, .016, x, .51, s * .325));
   glass.push(box(.32, .2, .01, 1.45, .92, s * .302));          // side windows
   glass.push(box(.14, .2, .01, 1.82, .92, s * .302));
  });
  glass.push(box(.02, .26, .5, 1.95, .98, 0, 0, 0, -.38));     // windscreen
  [-1.4, 1.4].forEach(bx => {                                  // Co-Co bogies
   dark.push(box(1.32, .1, .42, bx, .19, 0));
   [-1, 1].forEach(s => { dark.push(box(1.36, .1, .03, bx, .14, s * .2)); [-.42, 0, .42].forEach(ax => steel.push(cyl(.035, .035, .11, 8, bx + ax, .24, s * .2))); });
  });
  [-1, 1].forEach(s => { lamp.push(box(.012, .06, .07, 2.262, .64, s * .2)); lamp.push(box(.012, .05, .05, 2.262, .44, s * .24)); });
  lamp.push(box(.012, .05, .12, 1.9, 1.12, 0, 0, 0, -.3));
  return { paint: merge(paint), cyan: merge(cyan), dark: merge(dark), steel: merge(steel), glass: merge(glass), lamp: merge(lamp), axles: [-1.82, -1.4, -.98, .98, 1.4, 1.82] };
 }
 function buildWagon(loaded) {
  const paint = [], cyan = [], dark = [], ore = [];
  const L = 1.94;
  paint.push(box(L, .05, .58, 0, .42, 0));
  [-1, 1].forEach(s => {
   paint.push(box(L, .56, .03, 0, .72, s * .285));
   paint.push(box(L + .02, .045, .05, 0, 1.0, s * .29));
   for (let x = -L / 2 + .12; x <= L / 2 - .1; x += .216) paint.push(box(.04, .55, .025, x, .72, s * .305));
   paint.push(box(L, .04, .025, 0, .48, s * .305));
   cyan.push(box(.04, .58, .62, s * (L / 2 + .005), .72, 0));
   dark.push(box(.14, .06, .08, s * 1.03, .26, 0));
   dark.push(box(.66, .1, .42, s * .68, .19, 0));
   [-1, 1].forEach(z => dark.push(box(.7, .09, .03, s * .68, .14, z * .2)));
  });
  dark.push(box(1.9, .09, .4, 0, .34, 0));
  dark.push(box(.5, .14, .3, 0, .27, 0));
  if (loaded) {
   const g = new T.PlaneGeometry(L - .06, .54, 22, 7), p = g.attributes.position;
   for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (L / 2), z = p.getY(i) / .27;
    const mound = Math.max(0, 1 - x * x * .9) * Math.max(0, 1 - z * z * .95);
    const peaks = Math.exp(-(((x + .45) * 3) ** 2)) * .5 + Math.exp(-(((x - .4) * 3) ** 2)) * .55;
    p.setZ(i, .02 + mound * .1 + peaks * mound * .07 + (rnd() - .5) * .028 * mound);
   }
   g.rotateX(-Math.PI / 2); ore.push(part(g, 0, .93, 0));
  }
  return { paint: merge(paint), cyan: merge(cyan), dark: merge(dark), ore: ore.length ? merge(ore) : null, axles: [-.88, -.48, .48, .88] };
 }
 function buildWheelset() {
  const wheel = [], steel = [];
  [-1, 1].forEach(s => {
   wheel.push(cyl(.1, .1, .035, 20, 0, 0, s * .143, Math.PI / 2));
   wheel.push(cyl(.112, .112, .012, 20, 0, 0, s * .123, Math.PI / 2));
   steel.push(box(.05, .018, .012, .055, 0, s * .163));        // visible spoke marker — shows rotation
   steel.push(cyl(.03, .03, .02, 10, 0, 0, s * .168, Math.PI / 2));
  });
  wheel.push(cyl(.025, .025, .3, 8, 0, 0, 0, Math.PI / 2));
  return { wheel: merge(wheel), steel: merge(steel) };
 }

 /* ---------- track geometry ---------- */
 const BASE = [[-10, -1.72, -1.7], [-6, -1.55, -3.2], [-2, -1.38, -4.7], [2.8, -1.28, -6.2], [8.8, -1.05, -7.9]];
 function trackCurve(lateral = 0) {
  const pts = [[-33, -2.5, 7.4], [-24, -2.2, 3.6], [-17, -1.95, .6], ...BASE, [14, -.9, -9.3], [21, -.8, -10.9]].map(p => new T.Vector3(...p));
  const c = new T.CatmullRomCurve3(pts, false, 'catmullrom', .42);
  if (!lateral) return c;
  const n = 120, out = [];
  for (let i = 0; i <= n; i++) { const u = i / n, p = c.getPointAt(u), t = c.getTangentAt(u); out.push(p.add(new T.Vector3().crossVectors(t, UP).normalize().multiplyScalar(lateral))); }
  return new T.CatmullRomCurve3(out, false, 'catmullrom', .5);
 }
 function sideOf(curve, u) { return new T.Vector3().crossVectors(curve.getTangentAt(u), UP).normalize(); }
 function railTubes(curve, segs) {
  return [-.143, .143].map(off => {
   const pts = []; for (let i = 0; i <= 260; i++) { const u = i / 260; pts.push(curve.getPointAt(u).add(sideOf(curve, u).multiplyScalar(off))); }
   const c = new T.CatmullRomCurve3(pts); return new T.TubeGeometry(c, segs, .021, 5, false);
  });
 }
 function ballastGeometry(curve, light) {
  const n = light ? 140 : 320, prof = [[-1.15, -.55], [-.6, -.13], [-.36, -.05], [.36, -.05], [.6, -.13], [1.15, -.55]];
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= n; i++) {
   const u = i / n, p = curve.getPointAt(u), s = sideOf(curve, u);
   prof.forEach(([lx, ly], j) => {
    const jit = (j === 0 || j === 5) ? (rnd() - .5) * .25 : (rnd() - .5) * .015;
    pos.push(p.x + s.x * (lx + jit), p.y + ly + (rnd() - .5) * .02, p.z + s.z * (lx + jit));
    const g = .13 + rnd() * .09 - (j === 0 || j === 5 ? .06 : 0); col.push(g * .92, g, g * 1.02);
   });
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < 5; j++) { const a = i * 6 + j, b = a + 6; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
 }

 /* ---------- energy pulse along the rails (futuristic overlay) ---------- */
 function pulseMaterial(color) {
  return new T.ShaderMaterial({
   transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
   uniforms: { uTime: shared.uTime, uHead: { value: .5 }, uColor: { value: new T.Color(color) } },
   vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader: `varying vec2 vUv;uniform float uTime,uHead;uniform vec3 uColor;
void main(){float x=vUv.x;float ahead=(1.-smoothstep(uHead,uHead+.32,x))*step(uHead,x);
float pulses=pow(fract(x*28.-uTime*1.4),14.)*.9;float wake=smoothstep(uHead-.25,uHead,x)*step(x,uHead);
float a=.18+pulses*.55+ahead*1.4+wake*.6;gl_FragColor=vec4(uColor*a*1.6,a);}`
  });
 }

 /* ---------- particles (exhaust, sparks, ore dust) ---------- */
 function makeParticles(n) {
  const geo = new T.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new T.BufferAttribute(size, 1)); geo.setAttribute('aAlpha', new T.BufferAttribute(alpha, 1));
  const mat = new T.ShaderMaterial({
   transparent: true, depthWrite: false, toneMapped: false, vertexColors: true,
   uniforms: { uScale: { value: 400 } },
   vertexShader: 'attribute float aSize,aAlpha;varying vec3 vC;varying float vA;uniform float uScale;void main(){vC=color;vA=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*uScale/max(.1,-mv.z);gl_Position=projectionMatrix*mv;}',
   fragmentShader: 'varying vec3 vC;varying float vA;void main(){vec2 d=gl_PointCoord-.5;float r=length(d);float a=(1.-smoothstep(.0,.5,r));gl_FragColor=vec4(vC*a*vA,a*vA);}',
   blending: T.AdditiveBlending,
  });
  const pts = new T.Points(geo, mat); pts.frustumCulled = false;
  const state = Array.from({ length: n }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, kind: 0 }));
  return { pts, geo, mat, state, pos, col, size, alpha, cursor: 0 };
 }
 function emit(P, kind, p, v, life) {
  const i = P.cursor; P.cursor = (P.cursor + 1) % P.state.length;
  const s = P.state[i]; s.life = life; s.max = life; s.kind = kind; s.vx = v.x; s.vy = v.y; s.vz = v.z;
  P.pos[i * 3] = p.x; P.pos[i * 3 + 1] = p.y; P.pos[i * 3 + 2] = p.z;
 }
 function stepParticles(P, dt) {
  for (let i = 0; i < P.state.length; i++) {
   const s = P.state[i];
   if (s.life <= 0) { P.alpha[i] = 0; continue; }
   s.life -= dt; const k = 1 - s.life / s.max;
   if (s.kind === 1) s.vy -= 3.2 * dt;            // sparks fall
   else { s.vx *= 1 - dt * .6; s.vz *= 1 - dt * .6; s.vy *= 1 - dt * .3; }
   P.pos[i * 3] += s.vx * dt; P.pos[i * 3 + 1] += s.vy * dt; P.pos[i * 3 + 2] += s.vz * dt;
   if (s.kind === 0) { P.size[i] = .16 + k * .9; P.alpha[i] = Math.sin(k * Math.PI) * .22; P.col[i * 3] = .55; P.col[i * 3 + 1] = .72; P.col[i * 3 + 2] = .74; }
   else if (s.kind === 1) { P.size[i] = .035; P.alpha[i] = (1 - k) * 1.8; P.col[i * 3] = 2.6; P.col[i * 3 + 1] = 1.25; P.col[i * 3 + 2] = .35; }
   else { P.size[i] = .1 + k * .55; P.alpha[i] = Math.sin(k * Math.PI) * .16; P.col[i * 3] = .7; P.col[i * 3 + 1] = .38; P.col[i * 3 + 2] = .22; }
  }
  P.geo.attributes.position.needsUpdate = P.geo.attributes.color.needsUpdate = P.geo.attributes.aSize.needsUpdate = P.geo.attributes.aAlpha.needsUpdate = true;
 }

 /* ---------- headlight beam ---------- */
 function beamMaterial() {
  return new T.ShaderMaterial({
   transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false,
   uniforms: { uTime: shared.uTime, uPower: { value: 1 } },
   vertexShader: 'varying vec2 vUv;varying vec3 vN,vV;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
   fragmentShader: `varying vec2 vUv;varying vec3 vN,vV;uniform float uTime,uPower;
float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5);}
void main(){float along=vUv.y;float edge=pow(abs(dot(vN,vV)),1.6);float dust=.75+.25*sin(along*40.-uTime*6.+vUv.x*30.);
float a=pow(along,2.2)*edge*.42*dust*uPower;gl_FragColor=vec4(vec3(1.,.9,.68)*a,a);}`
  });
 }

 /* ================= RAILWAY + TRAINS ================= */
 function Railway({ progress, light = false }) {
  const R = React.useMemo(() => {
   seed = 11;
   const curve = trackCurve(0), curve2 = trackCurve(.92), len = curve.getLength(), len2 = curve2.getLength();
   // Map the original head path (old train u .29→.91 on the base curve) onto the extended curve.
   const base = new T.CatmullRomCurve3(BASE.map(p => new T.Vector3(...p)), false, 'catmullrom', .42);
   const N = 900, samples = []; for (let i = 0; i <= N; i++) samples.push(curve.getPointAt(i / N));
   const nearest = p => { let best = 0, bd = 1e9; for (let i = 0; i <= N; i++) { const d = samples[i].distanceToSquared(p); if (d < bd) { bd = d; best = i; } } return best / N; };
   const uStart = nearest(base.getPointAt(.29)), uEnd = nearest(base.getPointAt(.91));
   const M = makeMaterials();
   const loco = buildLoco(), wagon = buildWagon(true), empty = buildWagon(false), ws = buildWheelset();
   const nW = light ? 5 : 9, nW2 = light ? 0 : 7;
   const mk = (geo, mat, count) => { const m = new T.InstancedMesh(geo, mat, count); m.frustumCulled = false; m.instanceMatrix.setUsage(T.DynamicDrawUsage); return m; };
   const group = new T.Group();
   // track
   const ballast = new T.Mesh(ballastGeometry(curve, light), M.ballast); group.add(ballast);
   const railsGeo = railTubes(curve, light ? 260 : 520); railsGeo.forEach(g => group.add(new T.Mesh(g, M.rail)));
   const pulseMat = pulseMaterial('#e3893e'); railsGeo.forEach(g => { const m = new T.Mesh(g, pulseMat); m.scale.setScalar(1); m.renderOrder = 2; group.add(m); });
   const spacing = light ? .42 : .26, nS = Math.floor(len / spacing), nS2 = light ? 0 : Math.floor(len2 / (spacing * 1.6));
   const sleepers = mk(new T.BoxGeometry(.065, .045, .56), M.sleeper, nS + nS2);
   const o = new T.Object3D();
   for (let i = 0; i < nS; i++) { const u = (i + .5) / nS; o.position.copy(curve.getPointAt(u)); o.position.y -= .042; o.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), curve.getTangentAt(u)); o.updateMatrix(); sleepers.setMatrixAt(i, o.matrix); }
   if (!light) {
    group.add(new T.Mesh(ballastGeometry(curve2, true), M.ballast));
    railTubes(curve2, 300).forEach(g => group.add(new T.Mesh(g, M.rail2)));
    for (let i = 0; i < nS2; i++) { const u = (i + .5) / nS2; o.position.copy(curve2.getPointAt(u)); o.position.y -= .042; o.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), curve2.getTangentAt(u)); o.updateMatrix(); sleepers.setMatrixAt(nS + i, o.matrix); }
   }
   sleepers.instanceMatrix.needsUpdate = true; group.add(sleepers);
   // rolling stock: main train (loco + loaded wagons) and an oncoming empty train
   const parts = {
    locoPaint: mk(loco.paint, M.paint, 2), locoCyan: mk(loco.cyan, M.cyan, 2), locoDark: mk(loco.dark, M.dark, 2), locoSteel: mk(loco.steel, M.steel, 2), locoGlass: mk(loco.glass, M.glass, 2), locoLamp: mk(loco.lamp, M.lamp, 2),
    wPaint: mk(wagon.paint, M.paint, nW + nW2), wCyan: mk(wagon.cyan, M.cyan, nW + nW2), wDark: mk(wagon.dark, M.dark, nW + nW2), wOre: mk(wagon.ore, M.ore, nW),
    wheel: mk(ws.wheel, M.dark, (6 + nW * 4) + (nW2 ? 6 + nW2 * 4 : 0)), wheelSteel: mk(ws.steel, M.steel, (6 + nW * 4) + (nW2 ? 6 + nW2 * 4 : 0)),
   };
   empty.paint.dispose(); empty.cyan.dispose(); empty.dark.dispose();
   Object.values(parts).forEach(m => group.add(m));
   // tail marker (EOT) and headlights
   const tail = new T.Mesh(new T.BoxGeometry(.03, .07, .07), M.red); group.add(tail);
   const beamGeo = new T.ConeGeometry(1.15, 7.5, 28, 1, true); beamGeo.translate(0, -3.75, 0); beamGeo.rotateZ(Math.PI / 2);
   const beamMat = beamMaterial(); const beam = new T.Mesh(beamGeo, beamMat); beam.renderOrder = 3; group.add(beam);
   const spot = new T.SpotLight('#ffe2b0', light ? 30 : 55, 16, .42, .65, 1.3); const spotTarget = new T.Object3D(); spot.target = spotTarget; group.add(spot, spotTarget);
   const cabLight = new T.PointLight('#6fe9ff', 1.6, 2.4, 2); group.add(cabLight);
   const P = makeParticles(light ? 160 : 520); group.add(P.pts);
   return { curve, curve2, len, len2, uStart, uEnd, M, group, parts, tail, beam, beamMat, spot, spotTarget, cabLight, P, pulseMat, nW, nW2, railsGeo,
    geos: [loco, wagon, ws], sleepers, ballast, headS: null, roll: 0, roll2: 0, t2: 0, emitAcc: 0, mats: Object.values(M) };
  }, [light]);

  React.useEffect(() => () => {
   R.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
   R.mats.forEach(m => m.dispose()); R.pulseMat.dispose(); R.beamMat.dispose(); R.P.mat.dispose();
  }, [R]);

  const tmp = React.useMemo(() => ({ a: new T.Vector3(), b: new T.Vector3(), c: new T.Vector3(), f: new T.Vector3(), s: new T.Vector3(), u: new T.Vector3(), m: new T.Matrix4(), w: new T.Matrix4(), q: new T.Quaternion(), e: new T.Euler(), one: new T.Vector3(1, 1, 1), z: new T.Vector3() }), []);

  // Place one vehicle with its two bogies on the curve; returns its world matrix in tmp.m.
  function place(curve, len, sCenter, half, sway, bob, dirSign) {
   if (sCenter - half < .01 || sCenter + half > len - .01) return tmp.m.makeScale(0, 0, 0);
   const ua = (sCenter + half * dirSign) / len, ub = (sCenter - half * dirSign) / len;
   curve.getPointAt(ua, tmp.a); curve.getPointAt(ub, tmp.b);
   tmp.c.addVectors(tmp.a, tmp.b).multiplyScalar(.5); tmp.c.y += .021 + bob;
   tmp.f.subVectors(tmp.a, tmp.b).normalize();
   tmp.s.crossVectors(tmp.f, UP).normalize(); tmp.u.crossVectors(tmp.s, tmp.f).normalize();
   tmp.m.makeBasis(tmp.f, tmp.u, tmp.s);
   if (sway) tmp.m.multiply(tmp.w.makeRotationX(sway));
   tmp.m.setPosition(tmp.c);
   return tmp.m;
  }
  function wheelsetMatrix(vehicle, x, angle, out) {
   tmp.w.makeRotationZ(-angle); tmp.w.setPosition(x, .1, 0);
   return out.multiplyMatrices(vehicle, tmp.w);
  }

  useFrame((state, dtRaw) => {
   const dt = Math.min(dtRaw, .05), t = state.clock.elapsedTime, p = clamp(progress.current, 0, 1);
   shared.uTime.value = t;
   const { curve, curve2, len, len2, parts, P, nW, nW2 } = R;
   // ---- main train: head arc position follows the scroll ----
   const target = (R.uStart + (R.uEnd - R.uStart) * p) * len + 1.6;
   if (R.headS === null) R.headS = target;
   const prev = R.headS; R.headS += (target - R.headS) * (1 - Math.exp(-dt * 6));
   const ds = R.headS - prev, v = ds / Math.max(dt, 1e-3);
   live.velocity += (v - live.velocity) * (1 - Math.exp(-dt * 8)); live.speed = Math.abs(live.velocity); live.time = t;
   shared.uVelocity.value = live.speed;
   R.roll += ds / .1;
   const vib = Math.min(1, live.speed / 4);
   let wi = 0;
   // locomotive
   let s = R.headS - LOCO_L / 2;
   const lm = place(curve, len, s, 1.4, Math.sin(t * 7.3) * .004 * vib, Math.sin(t * 13) * .003 * vib, 1).clone();
   [parts.locoPaint, parts.locoCyan, parts.locoDark, parts.locoSteel, parts.locoGlass, parts.locoLamp].forEach(m => m.setMatrixAt(0, lm));
   R.geos[0].axles.forEach(x => { const wm = wheelsetMatrix(lm, x, R.roll, new T.Matrix4()); parts.wheel.setMatrixAt(wi, wm); parts.wheelSteel.setMatrixAt(wi, wm); wi++; });
   // lights follow the cab
   tmp.a.set(2.3, .6, 0).applyMatrix4(lm); tmp.f.set(1, 0, 0).transformDirection(lm);
   live.head.copy(tmp.a); live.headDir.copy(tmp.f);
   R.beam.position.copy(tmp.a); R.beam.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), tmp.b.copy(tmp.f).add(tmp.c.set(0, -.11, 0)).normalize());
   R.beamMat.uniforms.uPower.value = .85 + Math.sin(t * 31) * .03 + vib * .25;
   R.spot.position.copy(tmp.a); R.spotTarget.position.copy(tmp.a).addScaledVector(tmp.f, 6).add(tmp.c.set(0, -1.1, 0));
   R.cabLight.position.set(1.5, .95, 0).applyMatrix4(lm);
   // loaded wagons
   s -= LOCO_L / 2 + GAP + WAGON_L / 2;
   for (let k = 0; k < nW; k++) {
    const wm = place(curve, len, s, .68, Math.sin(t * 6.1 + k * 1.7) * .006 * vib, Math.sin(t * 11 + k) * .003 * vib, 1).clone();
    parts.wPaint.setMatrixAt(k, wm); parts.wCyan.setMatrixAt(k, wm); parts.wDark.setMatrixAt(k, wm); parts.wOre.setMatrixAt(k, wm);
    R.geos[1].axles.forEach(x => { const m = wheelsetMatrix(wm, x, R.roll, new T.Matrix4()); parts.wheel.setMatrixAt(wi, m); parts.wheelSteel.setMatrixAt(wi, m); wi++; });
    if (k === nW - 1) { tmp.a.set(-1.0, .55, .2).applyMatrix4(wm); R.tail.position.copy(tmp.a); R.tail.quaternion.setFromRotationMatrix(wm); R.tail.visible = Math.sin(t * 5) > -.2; }
    s -= WAGON_L + GAP;
   }
   R.pulseMat.uniforms.uHead.value = R.headS / len;
   // ---- oncoming empty train on the second track, always rolling ----
   if (nW2) {
    const total = LOCO_L + nW2 * (WAGON_L + GAP), speed = 2.6;
    R.t2 = (R.t2 + dt * speed) % (len2 + total + 24);
    let s2 = len2 + 6 - R.t2; R.roll2 += dt * speed / .1;
    const l2 = place(curve2, len2, s2 + LOCO_L / 2 - LOCO_L / 2, 1.4, 0, Math.sin(t * 12) * .002, -1).clone();
    [parts.locoPaint, parts.locoCyan, parts.locoDark, parts.locoSteel, parts.locoGlass, parts.locoLamp].forEach(m => m.setMatrixAt(1, l2));
    R.geos[0].axles.forEach(x => { const m = wheelsetMatrix(l2, x, R.roll2, new T.Matrix4()); parts.wheel.setMatrixAt(wi, m); parts.wheelSteel.setMatrixAt(wi, m); wi++; });
    s2 += LOCO_L / 2 + GAP + WAGON_L / 2;
    for (let k = 0; k < nW2; k++) {
     const wm = place(curve2, len2, s2, .68, 0, Math.sin(t * 10 + k) * .002, -1).clone();
     parts.wPaint.setMatrixAt(nW + k, wm); parts.wCyan.setMatrixAt(nW + k, wm); parts.wDark.setMatrixAt(nW + k, wm);
     R.geos[1].axles.forEach(x => { const m = wheelsetMatrix(wm, x, R.roll2, new T.Matrix4()); parts.wheel.setMatrixAt(wi, m); parts.wheelSteel.setMatrixAt(wi, m); wi++; });
     s2 += WAGON_L + GAP;
    }
   }
   Object.values(parts).forEach(m => { m.instanceMatrix.needsUpdate = true; });
   // ---- particles: exhaust (always), sparks + ore dust (with speed) ----
   R.emitAcc += dt * (8 + live.speed * 26);
   while (R.emitAcc > 1) {
    R.emitAcc -= 1;
    tmp.a.set(.3, 1.08, 0).applyMatrix4(lm);
    emit(P, 0, tmp.a, tmp.b.set((Math.random() - .5) * .2, .55 + Math.random() * .3, (Math.random() - .5) * .2).addScaledVector(live.headDir, -live.velocity * .35), 2.2 + Math.random());
    if (live.speed > .35 && Math.random() < .55) {
     const x = [-1.82, -.98, .98, 1.82][Math.random() * 4 | 0];
     tmp.a.set(x, .02, (Math.random() < .5 ? -1 : 1) * .15).applyMatrix4(lm);
     emit(P, 1, tmp.a, tmp.b.set((Math.random() - .5) * 1.2, .5 + Math.random() * .9, (Math.random() - .5) * 1.2).addScaledVector(live.headDir, -live.velocity * .4), .35 + Math.random() * .3);
    }
    if (live.speed > .2 && Math.random() < .5) {
     tmp.a.copy(R.tail.position); tmp.a.y -= .45;
     emit(P, 2, tmp.a, tmp.b.set((Math.random() - .5) * .5, .15 + Math.random() * .3, (Math.random() - .5) * .5), 1.6);
    }
   }
   stepParticles(P, dt);
   P.mat.uniforms.uScale.value = state.size.height * .55;
  }, -1);

  return h('primitive', { object: R.group });
 }

 /* ================= TERRAIN SCAN WIREFRAME ================= */
 function ScanWire({ opacity = .13 }) {
  const mat = React.useMemo(() => new T.ShaderMaterial({
   wireframe: true, transparent: true, depthWrite: false, toneMapped: false,
   uniforms: { uTime: shared.uTime, uScan: shared.uScan, uVelocity: shared.uVelocity, uOpacity: { value: opacity } },
   vertexShader: 'varying vec3 vW;varying float vD;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mv=viewMatrix*w;vD=-mv.z;gl_Position=projectionMatrix*mv;}',
   fragmentShader: `varying vec3 vW;varying float vD;uniform float uTime,uScan,uVelocity,uOpacity;
void main(){vec3 base=vec3(.192,.839,.627);float scan=exp(-pow((vW.x-uScan)*1.6,2.));float trail=smoothstep(uScan-6.,uScan,vW.x)*step(vW.x,uScan)*.35;
float contour=smoothstep(.92,1.,fract(vW.y*3.-uTime*.08))*.6;float fog=1.-smoothstep(8.,28.,vD);
float a=uOpacity*(1.+contour+uVelocity*.25)+scan*.55+trail*uOpacity*2.;vec3 c=mix(base,vec3(.6,1.,.9),scan)+vec3(.9,.45,.15)*contour*.25;
gl_FragColor=vec4(c*(1.+scan*2.),a*fog);}`
  }), [opacity]);
  React.useEffect(() => () => mat.dispose(), [mat]);
  return h('primitive', { object: mat, attach: 'material' });
 }

 /* ================= ATMOSPHERE ================= */
 function Atmosphere({ light = false, motionPaused = false }) {
  const A = React.useMemo(() => {
   const group = new T.Group();
   // Sky dome with horizon glow, twinkling stars and a slow aurora band.
   const sky = new T.Mesh(new T.SphereGeometry(48, 48, 24), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { uTime: shared.uTime },
    vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 vD;uniform float uTime;
float hash(vec3 p){p=fract(p*.3183+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
void main(){float y=vD.y;vec3 c=mix(vec3(.008,.035,.05),vec3(.003,.012,.02),smoothstep(0.,.6,y));
c+=vec3(.0,.16,.13)*exp(-abs(y-.02)*9.)*.55+vec3(.35,.16,.05)*exp(-abs(y+.02)*14.)*.35;
float band=exp(-pow((y-.32-.06*sin(vD.x*3.+uTime*.05))*7.,2.))*(.5+.5*sin(vD.x*9.+vD.z*5.+uTime*.12));c+=vec3(.0,.35,.25)*band*.12;
vec3 g=floor(vD*220.);float s=hash(g);float star=step(.9965,s)*smoothstep(.0,.25,y)*(.6+.4*sin(uTime*2.+s*80.));c+=vec3(.8,1.,.95)*star*.9;
gl_FragColor=vec4(c,1.);}`
   }));
   sky.renderOrder = -10; sky.frustumCulled = false; group.add(sky);
   // Drifting fog banks across the valley.
   const fogMat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    uniforms: { uTime: shared.uTime },
    vertexShader: 'varying vec2 vUv;varying float vD;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vD=-mv.z;gl_Position=projectionMatrix*mv;}',
    fragmentShader: `varying vec2 vUv;varying float vD;uniform float uTime;
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5),b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5),c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5),d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5);return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
void main(){vec2 p=vUv*vec2(5.,1.6);float f=fbm(p+vec2(uTime*.035,0.))*fbm(p*1.7-vec2(uTime*.02,.0));
float edge=smoothstep(0.,.25,vUv.y)*(1.-smoothstep(.45,1.,vUv.y))*smoothstep(0.,.15,vUv.x)*(1.-smoothstep(.85,1.,vUv.x));
float near=smoothstep(1.5,5.,vD);float a=f*f*edge*near*.32;gl_FragColor=vec4(vec3(.32,.62,.6)*a,a);}`
   });
   (light ? [[0, -1.0, -9, 26, 3.4]] : [[-2, -1.3, -4.5, 22, 2.6], [3, -.6, -9.2, 30, 3.6], [-6, -.2, -12, 30, 4.2], [6, -1.6, -2.2, 18, 2]]).forEach(([x, y, z, w, hh], i) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, hh), fogMat); m.position.set(x, y, z); m.rotation.y = -.18 + i * .05; m.renderOrder = 4; group.add(m);
   });
   // Bokeh dust motes.
   const n = light ? 140 : 520, pos = new Float32Array(n * 3), ph = new Float32Array(n);
   let s = 91; const r = () => (s = s * 16807 % 2147483647, (s - 1) / 2147483646);
   for (let i = 0; i < n; i++) { pos[i * 3] = (r() - .5) * 34; pos[i * 3 + 1] = -1.8 + r() * 9; pos[i * 3 + 2] = 4 - r() * 20; ph[i] = r(); }
   const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(pos, 3)); dg.setAttribute('aPh', new T.BufferAttribute(ph, 1));
   const dust = new T.Points(dg, new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
    uniforms: { uTime: shared.uTime, uScale: { value: 300 }, uVel: shared.uVelocity },
    vertexShader: `attribute float aPh;uniform float uTime,uScale,uVel;varying float vA,vB;void main(){vec3 p=position;p.x+=sin(uTime*.15+aPh*40.)*.6-uTime*.12*(1.+aPh);p.x=mod(p.x+17.,34.)-17.;p.y+=sin(uTime*.3+aPh*20.)*.25;
vec4 mv=modelViewMatrix*vec4(p,1.);float d=-mv.z;vB=(1.-smoothstep(.5,4.,d));gl_PointSize=(1.5+aPh*2.5+vB*26.)*uScale/300./max(d*.25,.6);vA=(.35+.65*sin(uTime*1.3+aPh*60.))*(1.-smoothstep(14.,26.,d));gl_Position=projectionMatrix*mv;}`,
    fragmentShader: 'varying float vA,vB;void main(){float r=length(gl_PointCoord-.5);float a=mix((1.-smoothstep(0.,.5,r)),(1.-smoothstep(.35,.5,r))*.5,vB)*vA*mix(.9,.25,vB);gl_FragColor=vec4(vec3(.72,1.,.9)*a,a);}'
   }));
   dust.frustumCulled = false; group.add(dust);
   // Warp streaks: appear with scroll speed, fly past the camera.
   const sN = light ? 0 : 140, sp = new Float32Array(sN * 6), sa = new Float32Array(sN * 2);
   for (let i = 0; i < sN; i++) { const ang = r() * Math.PI * 2, rad = 1.2 + r() * 5, z = -2 - r() * 22; const x = Math.cos(ang) * rad * 1.6, y = Math.sin(ang) * rad; sp.set([x, y, z, x, y, z - .9 - r() * 1.4], i * 6); sa[i * 2] = 1; sa[i * 2 + 1] = 0; }
   const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3)); sg.setAttribute('aA', new T.BufferAttribute(sa, 1));
   const streakMat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
    uniforms: { uTime: shared.uTime, uK: { value: 0 }, uOff: { value: 0 } },
    vertexShader: 'attribute float aA;uniform float uOff;varying float vA,vZ;void main(){vec3 p=position;p.z=mod(p.z+uOff+24.,24.)-26.;vA=aA;vZ=p.z;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(p,1.);}',
    fragmentShader: 'uniform float uK;varying float vA,vZ;void main(){float a=vA*uK*smoothstep(-26.,-14.,vZ)*(1.-smoothstep(-4.,-.5,vZ));gl_FragColor=vec4(vec3(.55,1.,.85)*a,a);}'
   });
   const streaks = new T.LineSegments(sg, streakMat); streaks.frustumCulled = false; if (sN) group.add(streaks);
   // Cool rim light so the train silhouette reads against the night.
   const rim = new T.DirectionalLight('#7fe7ff', 1.4); rim.position.set(6, 4, -10); group.add(rim, rim.target);
   const hemi = new T.HemisphereLight('#2b6a78', '#120a06', .55); group.add(hemi);
   return { group, sky, dust, streaks, streakMat, off: 0 };
  }, [light]);
  React.useEffect(() => () => A.group.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }), [A]);
  useFrame(({ camera, size }, dt) => {
   A.sky.position.copy(camera.position);
   A.dust.material.uniforms.uScale.value = size.height * .5;
   const k = clamp((live.speed - .6) / 3, 0, 1);
   A.streakMat.uniforms.uK.value += (k * .9 - A.streakMat.uniforms.uK.value) * Math.min(1, dt * 6);
   A.off += dt * (2 + live.speed * 9); A.streakMat.uniforms.uOff.value = A.off;
   A.streaks.position.copy(camera.position); A.streaks.quaternion.copy(camera.quaternion);
   shared.uScan.value = ((live.time * 2.4) % 40) - 16;
  });
  return h('primitive', { object: A.group });
 }

 /* ================= CAMERA RIG ================= */
 // Runs after the existing scroll camera: adds speed FOV, pointer parallax, roll and rumble.
 function CameraRig({ motionPaused = false, light = false }) {
  const rig = React.useRef({ fov: 0, roll: 0, px: 0, py: 0 });
  useFrame(({ camera, clock }, dtRaw) => {
   const r = rig.current, dt = Math.min(dtRaw, .05), t = clock.elapsedTime;
   if (!r.fov) r.fov = camera.fov;
   if (motionPaused) return;
   const P = live.pointer, e = 1 - Math.exp(-dt * 3);
   r.px += (P.tx - r.px) * e; r.py += (P.ty - r.py) * e;
   const sp = clamp(live.speed / 3.5, 0, 1);
   r.roll += (clamp(-live.velocity * .006, -.03, .03) - r.roll) * (1 - Math.exp(-dt * 4));
   camera.position.y += Math.sin(t * 23.1) * .006 * sp + Math.sin(t * 1.7) * .004;
   camera.position.x += Math.sin(t * 17.3 + 1) * .005 * sp;
   camera.rotateY(-r.px * (light ? .02 : .045)); camera.rotateX(-r.py * (light ? .012 : .028)); camera.rotateZ(r.roll + r.px * .008);
   const fov = r.fov + sp * 9; if (Math.abs(camera.fov - fov) > .01) { camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 5)); camera.updateProjectionMatrix(); }
  });
  return null;
 }

 /* ================= CINEMATIC POST PASS ================= */
 function CinematicPass({ light = false }) {
  const field = React.useRef({ x: .5, y: .5, tx: .5, ty: .5, speed: 0, blocked: true, stamp: 0 });
  const R = React.useMemo(() => {
   const quad = new T.PlaneGeometry(2, 2), cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), scene = new T.Scene();
   const mesh = new T.Mesh(quad); mesh.frustumCulled = false; scene.add(mesh);
   const half = { type: T.HalfFloatType, depthBuffer: false };
   const tScene = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, depthBuffer: true, samples: light ? 0 : 4 });
   const a = new T.WebGLRenderTarget(1, 1, half), b = new T.WebGLRenderTarget(1, 1, half), c = new T.WebGLRenderTarget(1, 1, half), d = new T.WebGLRenderTarget(1, 1, half);
   const VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
   const bright = new T.ShaderMaterial({ uniforms: { t: { value: null }, px: { value: new T.Vector2() } }, vertexShader: VS, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D t;uniform vec2 px;varying vec2 vUv;void main(){vec3 c=(texture2D(t,vUv+px*vec2(-1,-1)).rgb+texture2D(t,vUv+px*vec2(1,-1)).rgb+texture2D(t,vUv+px*vec2(-1,1)).rgb+texture2D(t,vUv+px*vec2(1,1)).rgb)*.25;c=clamp(c,0.,64.);if(c.r!=c.r||c.g!=c.g||c.b!=c.b)c=vec3(0.);float l=max(c.r,max(c.g,c.b));float k=smoothstep(.55,1.4,l);gl_FragColor=vec4(c*k,1.);}' });
   const blur = new T.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new T.Vector2() } }, vertexShader: VS, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D t;uniform vec2 dir;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb*.227;c+=(texture2D(t,vUv+dir*1.385).rgb+texture2D(t,vUv-dir*1.385).rgb)*.316;c+=(texture2D(t,vUv+dir*3.23).rgb+texture2D(t,vUv-dir*3.23).rgb)*.07;gl_FragColor=vec4(c,1.);}' });
   const comp = new T.ShaderMaterial({ toneMapped: false, depthTest: false, depthWrite: false,
    uniforms: { tScene: { value: tScene.texture }, tBloom: { value: c.texture }, tWide: { value: d.texture }, uMouse: { value: new T.Vector2(.5, .5) }, uStrength: { value: 0 }, uMouseVel: { value: 0 }, uAspect: { value: 1 }, uTime: { value: 0 }, uSpeed: { value: 0 }, uRes: { value: new T.Vector2(1, 1) }, uBloom: { value: light ? 0 : 1 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tScene,tBloom,tWide;uniform vec2 uMouse,uRes;uniform float uStrength,uMouseVel,uAspect,uTime,uSpeed,uBloom;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){vec2 delta=vUv-uMouse;delta.x*=uAspect;float lens=1.-smoothstep(0.,.23,length(delta));vec2 bend=delta*lens*lens*uStrength*(.45+uMouseVel);bend.x/=uAspect;
vec2 uv=clamp(vUv-bend,1./uRes,1.-1./uRes);vec2 fromC=uv-.5;float r2=dot(fromC,fromC);
vec2 ca=fromC*(.0035+uSpeed*.012)*(.3+r2*2.5);
vec3 col=vec3(texture2D(tScene,uv+ca).r,texture2D(tScene,uv).g,texture2D(tScene,uv-ca).b);
vec3 bl=texture2D(tBloom,uv).rgb*1.15+texture2D(tWide,uv).rgb*.9;col+=bl*uBloom;
col=col/(1.+max(col-1.,0.)*.6);
float vig=1.-smoothstep(.25,.95,length(fromC*vec2(1.,.85)));col*=mix(.55,1.,vig);
col=mix(col,col*vec3(.92,1.03,1.04),.35);
float g=hash(vUv*uRes+fract(uTime)*91.)-.5;col+=g*.028;
col*=1.-.025*sin(vUv.y*uRes.y*1.2+uTime*30.)*uSpeed;
gl_FragColor=vec4(max(col,0.),1.);
#include <colorspace_fragment>
}` });
   return { quad, cam, scene, mesh, tScene, a, b, c, d, bright, blur, comp, w: 0, hh: 0 };
  }, [light]);
  React.useEffect(() => {
   const f = field.current;
   function move(ev) {
    if (ev.pointerType === 'touch') return;
    const x = ev.clientX / innerWidth, y = 1 - ev.clientY / innerHeight, dt = Math.max(8, performance.now() - f.stamp);
    f.speed = clamp(Math.hypot(x - f.tx, y - f.ty) * 1000 / dt, 0, 1.6); f.tx = x; f.ty = y; f.stamp = performance.now();
    f.blocked = !!ev.target.closest?.('header,a,button,input,textarea,select,.partner-card,.institutional-logo');
   }
   const leave = () => { f.speed = 0; f.blocked = true; };
   window.addEventListener('pointermove', move, { passive: true }); document.addEventListener('pointerleave', leave);
   return () => { window.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); };
  }, []);
  React.useEffect(() => () => { [R.tScene, R.a, R.b, R.c, R.d].forEach(t => t.dispose()); [R.bright, R.blur, R.comp].forEach(m => m.dispose()); R.quad.dispose(); }, [R]);
  useFrame(({ gl, scene, camera, size, clock }, dtRaw) => {
   if (document.hidden) return;
   live.frames = (live.frames || 0) + 1; if (!live.first) live.first = performance.now();
   const f = field.current, d = Math.min(dtRaw, .05), ease = 1 - Math.exp(-d * 12);
   f.x += (f.tx - f.x) * ease; f.y += (f.ty - f.y) * ease; f.speed *= Math.exp(-d * 5);
   const u = R.comp.uniforms;
   u.uMouse.value.set(f.x, f.y); u.uMouseVel.value = f.speed;
   u.uStrength.value += ((light || f.blocked ? 0 : clamp(f.speed * .23, 0, .22)) - u.uStrength.value) * ease;
   u.uAspect.value = size.width / size.height; u.uTime.value = clock.elapsedTime;
   u.uSpeed.value += (clamp(live.speed / 4, 0, 1) - u.uSpeed.value) * ease;
   const ratio = Math.min(gl.getPixelRatio(), light ? 1 : 1.25), w = Math.round(size.width * ratio), hh = Math.round(size.height * ratio);
   if (w !== R.w || hh !== R.hh) {
    if (!R.w) {
     const hdr = !light && (gl.extensions.has('EXT_color_buffer_float') || gl.extensions.has('EXT_color_buffer_half_float'));
     if (!hdr) [R.tScene, R.a, R.b, R.c, R.d].forEach(t => { t.texture.type = T.UnsignedByteType; });
     if (!hdr) R.tScene.texture.colorSpace = T.SRGBColorSpace;
    }
    R.w = w; R.hh = hh; R.tScene.setSize(w, hh);
    const q = [Math.max(1, w >> 2), Math.max(1, hh >> 2)], e = [Math.max(1, w >> 3), Math.max(1, hh >> 3)];
    R.a.setSize(...q); R.c.setSize(...q); R.b.setSize(...e); R.d.setSize(...e); u.uRes.value.set(w, hh);
   }
   const pass = (mat, target) => { R.mesh.material = mat; gl.setRenderTarget(target); gl.render(R.scene, R.cam); };
   gl.setRenderTarget(R.tScene); gl.render(scene, camera);
   if (!light) {
    R.bright.uniforms.t.value = R.tScene.texture; R.bright.uniforms.px.value.set(1 / w, 1 / hh); pass(R.bright, R.a);
    R.blur.uniforms.t.value = R.a.texture; R.blur.uniforms.dir.value.set(1 / R.a.width, 0); pass(R.blur, R.c);
    R.blur.uniforms.t.value = R.c.texture; R.blur.uniforms.dir.value.set(0, 1 / R.a.height); pass(R.blur, R.a);
    R.blur.uniforms.t.value = R.a.texture; R.blur.uniforms.dir.value.set(2 / R.a.width, 0); pass(R.blur, R.c);
    R.blur.uniforms.t.value = R.c.texture; R.blur.uniforms.dir.value.set(0, 2 / R.a.height); pass(R.blur, R.a);
    // wide halo at 1/8
    R.blur.uniforms.t.value = R.a.texture; R.blur.uniforms.dir.value.set(2 / R.b.width, 0); pass(R.blur, R.b);
    R.blur.uniforms.t.value = R.b.texture; R.blur.uniforms.dir.value.set(0, 2 / R.b.height); pass(R.blur, R.d);
    u.tBloom.value = R.a.texture;
   }
   pass(R.comp, null);
   // Protected layer (official symbol) is drawn after post-processing, undistorted.
   const background = scene.background, mask = camera.layers.mask, clear = gl.autoClear;
   scene.background = null; camera.layers.set(1); gl.autoClear = false; gl.clearDepth(); gl.render(scene, camera);
   scene.background = background; camera.layers.mask = mask; gl.autoClear = clear;
  }, 1);
  return null;
 }

 return { Railway, ScanWire, Atmosphere, CameraRig, CinematicPass, live };
}
