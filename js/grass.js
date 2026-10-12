/* Meadow: one InstancedMesh of a tapered blade, duplicated tens of thousands of times on the GPU, over gently rolling
   ground seen from above at a slight angle. All motion happens in the vertex shader (value-noise wind + pointer push),
   so the CPU does no per-blade work. Golden dew sparkles are a single Points draw.
   pause() stops the render loop, hides the canvas and shrinks its drawing buffer to one pixel, so a paused meadow costs
   nothing per frame and almost no GPU memory; resume() restores it. */
import * as THREE from './vendor/three.module.min.js';

const NOISE = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float wind(vec2 xz, float phase, float time, float calm) {
  float n = vnoise(xz * 0.11 + vec2(time * 0.45, time * 0.17)) * 2.0 - 1.0;
  n += 0.3 * sin(time * 2.0 + phase);
  float gust = 0.5 + 0.6 * vnoise(xz * 0.02 + vec2(time * 0.12, 0.0));
  return n * gust * calm;
}`;

const BLADE_VS = `
attribute vec4 aInst; /* phase, tint, lean, width */
uniform float uTime, uCalm;
uniform vec3 uPointer; uniform float uPointerOn;
varying float vT, vTint, vWind, vDepth, vHeight;
${NOISE}
void main() {
  float t = position.y;
  vec3 p = position;
  p.x *= aInst.w;
  vec4 wp = instanceMatrix * vec4(p, 1.0);
  vec3 base = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float h = length(vec3(instanceMatrix[1].xyz));
  float bend = t * t;
  float w = wind(base.xz, aInst.x, uTime, uCalm);
  vec2 dir = normalize(vec2(1.0, 0.35));
  vec2 off = dir * (w + aInst.z) * h * 0.6 * bend;
  vec2 d = base.xz - uPointer.xz;
  float push = exp(-dot(d, d) / 1.4) * uPointerOn;
  off += normalize(d + vec2(0.001, 0.0)) * push * h * 0.9 * bend;
  wp.xz += off;
  wp.y -= length(off) * 0.35;
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  vT = t; vTint = aInst.y; vWind = w; vDepth = -mv.z; vHeight = base.y;
}`;

const BLADE_FS = `
precision mediump float;
uniform vec3 uFog; uniform float uFogNear, uFogFar;
varying float vT, vTint, vWind, vDepth, vHeight;
void main() {
  vec3 cBase = vec3(0.045, 0.19, 0.045);
  vec3 cMid  = vec3(0.28, 0.62, 0.12);
  vec3 cTip  = vec3(0.86, 0.93, 0.36);
  vec3 col = mix(cBase, cMid, smoothstep(0.0, 0.5, vT));
  col = mix(col, cTip, smoothstep(0.4, 1.0, vT) * (0.35 + 0.65 * vTint));
  col *= 0.72 + 0.46 * vTint;
  col += vec3(0.12, 0.10, 0.0) * vWind * vT;
  col *= 0.85 + 0.35 * clamp(vHeight * 0.6 + 0.5, 0.0, 1.0); /* hill tops catch more light */
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
    const half = 0.5 * (1 - t * 0.78);
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

/* rolling ground: a few sine hills plus hash noise, used for blades and the ground mesh alike */
function hill(x, z) {
  return 0.55 * Math.sin(x * 0.33 + 1.2) * Math.cos(z * 0.27 - 0.4) + 0.35 * Math.sin(x * 0.71 - z * 0.52 + 2.1) + 0.18 * Math.sin(x * 1.6 + z * 1.1);
}

export function createMeadow(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true });
  } catch (e) { return null; }

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.35 : 1;
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Mobi|Android/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 560;
  const COUNT = mobile || cores <= 4 ? 36000 : cores <= 8 ? 64000 : 96000;
  const DPR_CAP = mobile ? 1.25 : 1.5;

  const fog = new THREE.Color(0.86, 0.84, 0.52);
  const scene = new THREE.Scene();
  scene.background = fog;
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
  camera.position.set(0, 9.5, 7.5);
  camera.lookAt(0, 0, -3.5);

  /* ground, displaced into hills so nothing shows through */
  const ggeo = new THREE.PlaneGeometry(120, 120, 120, 120);
  ggeo.rotateX(-Math.PI / 2);
  const gp = ggeo.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, hill(gp.getX(i), gp.getZ(i)) - 0.05);
  const ground = new THREE.Mesh(ggeo, new THREE.ShaderMaterial({
    uniforms: { uFog: { value: fog }, uFogNear: { value: 14 }, uFogFar: { value: 42 } },
    vertexShader: 'varying float vD; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; vY = position.y; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'precision mediump float; uniform vec3 uFog; uniform float uFogNear, uFogFar; varying float vD; varying float vY; void main(){ vec3 g = mix(vec3(0.04, 0.16, 0.04), vec3(0.10, 0.30, 0.07), clamp(vY * 0.6 + 0.5, 0.0, 1.0)); gl_FragColor = vec4(mix(g, uFog, smoothstep(uFogNear, uFogFar, vD) * 0.85), 1.0); }'
  }));
  ground.position.z = -12;
  scene.add(ground);

  /* blades */
  const geo = bladeGeometry(mobile ? 3 : 4);
  const inst = new Float32Array(COUNT * 4);
  const mat = new THREE.ShaderMaterial({
    vertexShader: BLADE_VS, fragmentShader: BLADE_FS, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uCalm: { value: calm },
      uPointer: { value: new THREE.Vector3(0, 0, 999) }, uPointerOn: { value: 0 },
      uFog: { value: fog }, uFogNear: { value: 14 }, uFogFar: { value: 42 }
    }
  });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const NEAR_Z = 9.5, FAR_Z = -34, NEAR_W = 9, FAR_W = 34;
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random();
    const z = NEAR_Z + (FAR_Z - NEAR_Z) * Math.pow(u, 0.78);
    const k = (z - NEAR_Z) / (FAR_Z - NEAR_Z);
    const w = NEAR_W + (FAR_W - NEAR_W) * k;
    const x = (Math.random() * 2 - 1) * w;
    const h = 0.5 + Math.random() * 0.55;
    p.set(x, hill(x, z + 12) - 0.03, z);
    q.setFromAxisAngle(up, Math.random() * Math.PI);
    s.set(0.03 + Math.random() * 0.016, h, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    inst[i * 4] = Math.random() * 6.283;
    inst[i * 4 + 1] = Math.random();
    inst[i * 4 + 2] = (Math.random() - 0.5) * 0.6;
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

  /* pointer -> ground plane */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(up, 0), hit = new THREE.Vector3();
  const target = new THREE.Vector3(0, 0, 999);
  let pointerOn = 0, wantOn = 0, running = false;
  addEventListener('pointermove', (e) => {
    if (!running) return;
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) { target.copy(hit); wantOn = 1; }
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
    resume() { if (running) return; running = true; canvas.style.display = ''; resize(); raf = requestAnimationFrame(frame); },
    pause() {
      if (!running) return;
      running = false; cancelAnimationFrame(raf);
      canvas.style.display = 'none';
      renderer.setSize(1, 1, false); /* release the full-screen drawing buffer while the book covers the page */
    }
  };
  api.resume();
  return api;
}
