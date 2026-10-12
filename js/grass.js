/* Meadow, scene one only. One InstancedMesh of a thin tapered blade duplicated a hundred thousand times or more,
   combed by wind in the vertex shader so the field reads as a thick fur coat rather than separate stalks.
   The ground under the blades is the reader's own meadow photo, tiled, so no bare earth shows.
   The book presses the blades flat under its footprint and bends the ones around its edges outward.
   pause() stops the loop, hides the canvas and shrinks the drawing buffer; the reader scene never pays for it. */
import * as THREE from './vendor/three.module.min.js';

const NOISE = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
/* combed wind: a slow broad swell plus small gusts, all along one prevailing direction */
vec2 wind(vec2 xz, float phase, float time, float calm) {
  float swell = vnoise(xz * 0.07 + vec2(time * 0.35, time * 0.12)) * 2.0 - 1.0;
  float gust = vnoise(xz * 0.3 + vec2(time * 0.9, -time * 0.4)) - 0.5;
  float w = (0.55 + 0.45 * swell + 0.35 * gust + 0.12 * sin(time * 1.7 + phase)) * calm;
  vec2 dir = normalize(vec2(1.0, 0.42) + 0.35 * vec2(vnoise(xz * 0.05 + 3.1) - 0.5, vnoise(xz * 0.05 + 9.7) - 0.5));
  return dir * w;
}`;

const BLADE_VS = `
attribute vec4 aInst; /* phase, tint, lean, width */
uniform float uTime, uCalm;
uniform vec3 uPointer; uniform float uPointerOn;
uniform vec3 uBook; uniform vec2 uBookR; uniform float uBookOn;
varying float vT, vTint, vShade, vDepth, vHeight;
${NOISE}
void main() {
  float t = position.y;
  vec3 p = position;
  p.x *= aInst.w;
  vec4 wp = instanceMatrix * vec4(p, 1.0);
  vec3 base = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float h = length(vec3(instanceMatrix[1].xyz));
  float bend = t * t;
  vec2 w = wind(base.xz, aInst.x, uTime, uCalm);
  /* fur: every blade already lies well over, the wind only combs it further */
  vec2 off = (w * 0.7 + vec2(0.35, 0.12)) * h * bend + vec2(aInst.z, aInst.z * 0.4) * h * bend;
  vec2 d = base.xz - uPointer.xz;
  float push = exp(-dot(d, d) / 1.2) * uPointerOn;
  off += normalize(d + vec2(0.001, 0.0)) * push * h * 1.1 * bend;
  /* the book's weight: flat under it, splayed outward around the edge */
  vec2 bd = (base.xz - uBook.xz) / uBookR;
  float inside = 1.0 - smoothstep(0.85, 1.15, length(bd));
  float rim = exp(-pow((length(bd) - 1.05) * 2.6, 2.0));
  off += normalize(bd + vec2(0.001, 0.0)) * (rim * 1.2 + inside * 0.8) * h * bend * uBookOn;
  float flatten = 1.0 - inside * 0.82 * uBookOn;
  wp.y = base.y + (wp.y - base.y) * flatten;
  wp.xz += off;
  wp.y -= length(off) * 0.42;
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  float clump = vnoise(base.xz * 0.55) * 0.6 + vnoise(base.xz * 2.2) * 0.4;   /* tufts: neighbours share a tint */
  vT = t; vTint = mix(aInst.y, clump, 0.65); vShade = 0.5 + 0.5 * dot(normalize(off + vec2(0.001)), vec2(0.7, 0.3)); vDepth = -mv.z; vHeight = base.y;
}`;

const BLADE_FS = `
precision mediump float;
uniform vec3 uFog; uniform float uFogNear, uFogFar;
varying float vT, vTint, vShade, vDepth, vHeight;
void main() {
  vec3 cBase = vec3(0.05, 0.17, 0.04);
  vec3 cMid  = vec3(0.26, 0.58, 0.11);
  vec3 cTip  = vec3(0.84, 0.92, 0.38);
  vec3 col = mix(cBase, cMid, smoothstep(0.0, 0.45, vT));
  col = mix(col, cTip, smoothstep(0.35, 1.0, vT) * (0.25 + 0.75 * vTint));
  col *= 0.62 + 0.6 * vTint;
  /* soft sheen along the combed direction, like light on fur */
  col += vec3(0.16, 0.14, 0.02) * vShade * smoothstep(0.3, 1.0, vT);
  col *= 0.85 + 0.35 * clamp(vHeight * 0.6 + 0.5, 0.0, 1.0);
  float f = smoothstep(uFogNear, uFogFar, vDepth);
  col = mix(col, uFog, f * 0.85);
  gl_FragColor = vec4(col, 1.0);
}`;

const DOT_VS = `
attribute vec4 aDot; /* size, phase, speed, unused */
uniform float uTime, uCalm, uScale;
varying float vA;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.3 + aDot.y) * 0.25 * uCalm;
  p.y += cos(uTime * 0.24 + aDot.y * 1.7) * 0.18 * uCalm;
  float tw = 0.4 + 0.6 * sin(uTime * aDot.z + aDot.y);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aDot.x * uScale / -mv.z * (0.7 + 0.3 * tw);
  vA = tw;
}`;
const DOT_FS = `
precision mediump float;
varying float vA;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = length(c);
  float glow = exp(-r * r * 7.0);
  float rays = exp(-abs(c.x) * 22.0) * exp(-abs(c.y) * 2.2) + exp(-abs(c.y) * 22.0) * exp(-abs(c.x) * 2.2);
  float a = (glow + rays * 0.7) * vA;
  gl_FragColor = vec4(vec3(1.0, 0.9, 0.5) * a, a);
}`;

function bladeGeometry(segments) {
  const pos = [], idx = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const half = 0.5 * (1 - t * 0.7);
    if (i === segments) pos.push(0, 1, 0); else pos.push(-half, t, 0, half, t, 0);
  }
  for (let i = 0; i < segments - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const last = (segments - 1) * 2, tip = segments * 2;
  idx.push(last, last + 1, tip);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

function hill(x, z) {
  return 0.5 * Math.sin(x * 0.33 + 1.2) * Math.cos(z * 0.27 - 0.4) + 0.3 * Math.sin(x * 0.71 - z * 0.52 + 2.1) + 0.15 * Math.sin(x * 1.6 + z * 1.1);
}

export function createMeadow(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true });
  } catch (e) { return null; }

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.35 : 1;
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Mobi|Android/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 560;
  const COUNT = mobile || cores <= 4 ? 50000 : cores <= 8 ? 90000 : 130000;
  const DPR_CAP = mobile ? 1.25 : 1.5;

  const fog = new THREE.Color(0.86, 0.84, 0.52);
  const scene = new THREE.Scene();
  scene.background = fog;
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
  camera.position.set(0, 6.2, 6.5);
  camera.lookAt(0, 0.2, -3.2);

  /* ground: the meadow photo, tiled over rolling hills */
  const ggeo = new THREE.PlaneGeometry(120, 120, 120, 120);
  ggeo.rotateX(-Math.PI / 2);
  const gp = ggeo.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, hill(gp.getX(i), gp.getZ(i)) - 0.04);
  const gtex = new THREE.TextureLoader().load('assets/ground.webp');
  gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping;
  gtex.colorSpace = THREE.SRGBColorSpace;
  const gmat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: gtex }, uFog: { value: fog }, uFogNear: { value: 12 }, uFogFar: { value: 36 }, uBook: { value: new THREE.Vector3(0, 0, 999) }, uBookR: { value: new THREE.Vector2(1, 1) }, uBookOn: { value: 0 } },
    vertexShader: 'varying float vD; varying vec2 vUv; varying vec3 vW; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; vUv = uv; vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'precision mediump float; uniform sampler2D uTex; uniform vec3 uFog; uniform float uFogNear, uFogFar; uniform vec3 uBook; uniform vec2 uBookR; uniform float uBookOn; varying float vD; varying vec2 vUv; varying vec3 vW; void main(){ vec3 g = texture2D(uTex, vUv * 9.0).rgb * vec3(0.72, 0.8, 0.6); vec2 bd = (vW.xz - uBook.xz) / uBookR; float sh = (1.0 - smoothstep(0.7, 1.5, length(bd))) * uBookOn; g *= 1.0 - 0.55 * sh; gl_FragColor = vec4(mix(g, uFog, smoothstep(uFogNear, uFogFar, vD) * 0.85), 1.0); }'
  });
  const ground = new THREE.Mesh(ggeo, gmat);
  ground.position.z = -12;
  scene.add(ground);

  /* blades */
  const geo = bladeGeometry(3);
  const inst = new Float32Array(COUNT * 4);
  const mat = new THREE.ShaderMaterial({
    vertexShader: BLADE_VS, fragmentShader: BLADE_FS, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uCalm: { value: calm },
      uPointer: { value: new THREE.Vector3(0, 0, 999) }, uPointerOn: { value: 0 },
      uBook: gmat.uniforms.uBook, uBookR: gmat.uniforms.uBookR, uBookOn: gmat.uniforms.uBookOn,
      uFog: { value: fog }, uFogNear: { value: 12 }, uFogFar: { value: 36 }
    }
  });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const NEAR_Z = 8.5, FAR_Z = -30, NEAR_W = 8, FAR_W = 30;
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random();
    const z = NEAR_Z + (FAR_Z - NEAR_Z) * Math.pow(u, 0.85);
    const k = (z - NEAR_Z) / (FAR_Z - NEAR_Z);
    const w = NEAR_W + (FAR_W - NEAR_W) * k;
    const x = (Math.random() * 2 - 1) * w;
    const h = 0.6 + Math.random() * 0.45;
    p.set(x, hill(x, z + 12) - 0.03, z);
    q.setFromAxisAngle(up, Math.random() * Math.PI);
    s.set(0.034 + Math.random() * 0.022, h, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    inst[i * 4] = Math.random() * 6.283;
    inst[i * 4 + 1] = Math.random();
    inst[i * 4 + 2] = (Math.random() - 0.5) * 0.25;
    inst[i * 4 + 3] = 0.8 + Math.random() * 0.6;
  }
  geo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  /* golden dew sparkles */
  const SPARK = mobile ? 140 : 320;
  const dp = new Float32Array(SPARK * 3), dd = new Float32Array(SPARK * 4);
  for (let i = 0; i < SPARK; i++) {
    const z = NEAR_Z - 1 + (FAR_Z - NEAR_Z) * Math.pow(Math.random(), 0.8);
    const k = (z - NEAR_Z) / (FAR_Z - NEAR_Z);
    const w = NEAR_W + (FAR_W - NEAR_W) * k;
    const x = (Math.random() * 2 - 1) * w;
    dp[i * 3] = x; dp[i * 3 + 1] = hill(x, z + 12) + 0.4 + Math.random() * 1.8; dp[i * 3 + 2] = z;
    dd[i * 4] = 0.12 + Math.random() * 0.26; dd[i * 4 + 1] = Math.random() * 6.283; dd[i * 4 + 2] = 0.8 + Math.random() * 2.2; dd[i * 4 + 3] = 0;
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dgeo.setAttribute('aDot', new THREE.BufferAttribute(dd, 4));
  const dmat = new THREE.ShaderMaterial({ vertexShader: DOT_VS, fragmentShader: DOT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCalm: { value: calm }, uScale: { value: 300 } } });
  const dots = new THREE.Points(dgeo, dmat);
  dots.frustumCulled = false;
  scene.add(dots);

  /* pointer and book footprint -> ground plane */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(up, 0), hit = new THREE.Vector3();
  const target = new THREE.Vector3(0, 0, 999);
  let pointerOn = 0, wantOn = 0, running = false;
  function groundAt(sx, sy) {
    ndc.set(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
  }
  addEventListener('pointermove', (e) => {
    if (!running) return;
    const g = groundAt(e.clientX, e.clientY);
    if (g) { target.copy(g); wantOn = 1; }
  }, { passive: true });
  addEventListener('pointerleave', () => { wantOn = 0; });

  function resize() {
    if (!running) return;
    const dpr = Math.min(devicePixelRatio || 1, DPR_CAP);
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = innerWidth / innerHeight < 0.9 ? 64 : 46;
    camera.updateProjectionMatrix();
    dmat.uniforms.uScale.value = innerHeight * dpr * 0.5;
  }
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 120); });

  let raf = 0, t0 = performance.now();
  function frame(now) {
    if (!running) return;
    const time = (now - t0) / 1000;
    mat.uniforms.uTime.value = time;
    dmat.uniforms.uTime.value = time;
    pointerOn += (wantOn - pointerOn) * 0.08;
    mat.uniforms.uPointerOn.value = pointerOn;
    mat.uniforms.uPointer.value.lerp(target, 0.12);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  const api = {
    count: COUNT,
    get running() { return running; },
    /* where the book rests, from its on-screen rectangle; on=0 lifts the weight (the book floats) */
    setBook(rect, on) {
      if (!rect) { gmat.uniforms.uBookOn.value = 0; return; }
      const c = groundAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const r = groundAt(rect.right, rect.top + rect.height / 2);
      const b = groundAt(rect.left + rect.width / 2, rect.bottom);
      if (!c || !r || !b) return;
      gmat.uniforms.uBook.value.copy(c);
      gmat.uniforms.uBookR.value.set(Math.max(0.5, Math.abs(r.x - c.x)), Math.max(0.5, Math.abs(b.z - c.z)));
      gmat.uniforms.uBookOn.value = on;
    },
    resume() { if (running) return; running = true; canvas.style.display = ''; resize(); raf = requestAnimationFrame(frame); },
    pause() {
      if (!running) return;
      running = false; cancelAnimationFrame(raf);
      canvas.style.display = 'none';
      renderer.setSize(1, 1, false);
    }
  };
  api.resume();
  return api;
}
