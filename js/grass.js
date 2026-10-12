/* Meadow: one InstancedMesh of a tapered blade, duplicated tens of thousands of times on the GPU.
   All motion happens in the vertex shader (value noise wind + pointer push), so the CPU does no per-blade work
   and the only per-frame upload is a handful of uniforms. Daisies and golden dew sparkles are a single Points draw.
   Exposes pause()/resume() so the book can switch the meadow off while a recipe fills the screen. */
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
  float n = vnoise(xz * 0.09 + vec2(time * 0.42, time * 0.16)) * 2.0 - 1.0;
  n += 0.35 * sin(time * 2.1 + phase);
  float gust = 0.55 + 0.6 * vnoise(xz * 0.018 + vec2(time * 0.11, 0.0));
  return n * gust * calm;
}`;

const BLADE_VS = `
attribute vec4 aInst; /* phase, tint, lean, width */
uniform float uTime, uCalm;
uniform vec3 uPointer; uniform float uPointerOn;
varying float vT, vTint, vWind, vDepth;
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
  vec2 dir = normalize(vec2(1.0, 0.45));
  vec2 off = dir * (w + aInst.z) * h * 0.55 * bend;
  vec2 d = base.xz - uPointer.xz;
  float push = exp(-dot(d, d) / 1.1) * uPointerOn;
  off += normalize(d + vec2(0.001, 0.0)) * push * h * 0.9 * bend;
  wp.xz += off;
  wp.y -= length(off) * 0.35;
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  vT = t; vTint = aInst.y; vWind = w; vDepth = -mv.z;
}`;

const BLADE_FS = `
precision mediump float;
uniform vec3 uFog; uniform float uFogNear, uFogFar;
varying float vT, vTint, vWind, vDepth;
void main() {
  vec3 cBase = vec3(0.030, 0.17, 0.040);
  vec3 cMid  = vec3(0.20, 0.57, 0.10);
  vec3 cTip  = vec3(0.82, 0.90, 0.32);
  vec3 col = mix(cBase, cMid, smoothstep(0.0, 0.55, vT));
  col = mix(col, cTip, smoothstep(0.45, 1.0, vT) * (0.4 + 0.6 * vTint));
  col *= 0.76 + 0.44 * vTint;
  col += vec3(0.10, 0.08, 0.0) * vWind * vT;
  float f = smoothstep(uFogNear, uFogFar, vDepth);
  col = mix(col, uFog, f);
  gl_FragColor = vec4(col, 1.0);
}`;

const DOT_VS = `
attribute vec4 aDot; /* size, phase, kind, speed */
uniform float uTime, uCalm, uScale;
varying float vKind, vA;
${NOISE}
void main() {
  vec3 p = position;
  float kind = aDot.z;
  float tw = 1.0;
  if (kind > 0.5) {
    p.x += wind(p.xz, aDot.y, uTime, uCalm) * 0.08;
  } else {
    p.x += sin(uTime * 0.3 + aDot.y) * 0.25 * uCalm;
    p.y += cos(uTime * 0.24 + aDot.y * 1.7) * 0.18 * uCalm;
    tw = 0.4 + 0.6 * sin(uTime * aDot.w + aDot.y);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aDot.x * uScale / -mv.z * (kind > 0.5 ? 1.0 : 0.7 + 0.3 * tw);
  vKind = kind; vA = tw;
}`;

const DOT_FS = `
precision mediump float;
varying float vKind, vA;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = length(c);
  if (vKind > 0.5) {
    float ang = atan(c.y, c.x);
    float petal = 0.58 + 0.42 * abs(cos(ang * 5.0));
    float edge = smoothstep(petal, petal - 0.14, r);
    float core = smoothstep(0.27, 0.2, r);
    if (edge < 0.01) discard;
    vec3 col = mix(vec3(0.99, 0.98, 0.93), vec3(0.98, 0.78, 0.16), core);
    col *= 1.0 - 0.18 * smoothstep(0.45, 0.9, r);
    gl_FragColor = vec4(col, edge);
  } else {
    float glow = exp(-r * r * 7.0);
    float rays = exp(-abs(c.x) * 22.0) * exp(-abs(c.y) * 2.2) + exp(-abs(c.y) * 22.0) * exp(-abs(c.x) * 2.2);
    float a = (glow + rays * 0.7) * vA;
    gl_FragColor = vec4(vec3(1.0, 0.88, 0.45) * a, a);
  }
}`;

function bladeGeometry(segments) {
  const pos = [], idx = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const half = 0.5 * (1 - t * 0.78);
    if (i === segments) { pos.push(0, 1, 0); }
    else { pos.push(-half, t, 0, half, t, 0); }
  }
  for (let i = 0; i < segments - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const last = (segments - 1) * 2, tip = segments * 2;
  idx.push(last, last + 1, tip);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function createMeadow(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true });
  } catch (e) { return null; }

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.35 : 1;
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Mobi|Android/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 560;
  const COUNT = mobile || cores <= 4 ? 34000 : cores <= 8 ? 60000 : 90000;
  const DPR_CAP = mobile ? 1.25 : 1.5;

  const fog = new THREE.Color(0.74, 0.70, 0.36);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  camera.position.set(0, 1.9, 6.2);
  camera.lookAt(0, 0.7, -2);

  /* sky: one gradient dome, drawn once per frame behind everything */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uHorizon: { value: fog }, uZenith: { value: new THREE.Color(0.93, 0.86, 0.56) }, uSun: { value: new THREE.Color(1.0, 0.95, 0.72) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'precision mediump float; uniform vec3 uHorizon, uZenith, uSun; varying vec3 vP; void main(){ vec3 d = normalize(vP); float h = clamp(d.y * 2.2, 0.0, 1.0); vec3 c = mix(uHorizon, uZenith, pow(h, 0.6)); float s = pow(max(dot(d, normalize(vec3(0.35, 0.22, -1.0))), 0.0), 18.0); c = mix(c, uSun, s * 0.8); gl_FragColor = vec4(c, 1.0); }'
  }));
  sky.frustumCulled = false;
  scene.add(sky);

  /* ground, so nothing shows through between blades */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.ShaderMaterial({
      uniforms: { uFog: { value: fog }, uFogNear: { value: 10 }, uFogFar: { value: 34 } },
      vertexShader: 'varying float vD; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'precision mediump float; uniform vec3 uFog; uniform float uFogNear, uFogFar; varying float vD; void main(){ gl_FragColor = vec4(mix(vec3(0.05, 0.19, 0.05), uFog, smoothstep(uFogNear, uFogFar, vD)), 1.0); }'
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, -12);
  scene.add(ground);

  /* blades */
  const geo = bladeGeometry(mobile ? 3 : 4);
  const inst = new Float32Array(COUNT * 4);
  const mat = new THREE.ShaderMaterial({
    vertexShader: BLADE_VS, fragmentShader: BLADE_FS, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uCalm: { value: calm },
      uPointer: { value: new THREE.Vector3(0, 0, 999) }, uPointerOn: { value: 0 },
      uFog: { value: fog }, uFogNear: { value: 10 }, uFogFar: { value: 34 }
    }
  });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const NEAR_Z = 5.9, FAR_Z = -22, NEAR_W = 5.2, FAR_W = 26;
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random();
    const z = NEAR_Z + (FAR_Z - NEAR_Z) * Math.pow(u, 0.72);  /* denser near the camera for the fur-blanket look, still thick far off */
    const k = (z - NEAR_Z) / (FAR_Z - NEAR_Z);
    const w = NEAR_W + (FAR_W - NEAR_W) * k;
    const x = (Math.random() * 2 - 1) * w;
    const h = 0.42 + Math.random() * 0.5;
    p.set(x, 0, z);
    q.setFromAxisAngle(up, Math.random() * Math.PI);
    s.set(0.026 + Math.random() * 0.014, h, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    inst[i * 4] = Math.random() * 6.283;
    inst[i * 4 + 1] = Math.random();
    inst[i * 4 + 2] = (Math.random() - 0.5) * 0.5;
    inst[i * 4 + 3] = 0.8 + Math.random() * 0.6;
  }
  geo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  /* daisies + sparkles as one Points draw */
  const DAISY = mobile ? 90 : 170, SPARK = mobile ? 120 : 260;
  const dp = new Float32Array((DAISY + SPARK) * 3), dd = new Float32Array((DAISY + SPARK) * 4);
  for (let i = 0; i < DAISY + SPARK; i++) {
    const daisy = i < DAISY;
    const z = NEAR_Z - 0.5 + (FAR_Z - NEAR_Z) * Math.pow(Math.random(), 0.75);
    const k = (z - NEAR_Z) / (FAR_Z - NEAR_Z);
    const w = NEAR_W + (FAR_W - NEAR_W) * k;
    dp[i * 3] = (Math.random() * 2 - 1) * w;
    dp[i * 3 + 1] = daisy ? 0.5 + Math.random() * 0.35 : 0.3 + Math.random() * 2.2;
    dp[i * 3 + 2] = z;
    dd[i * 4] = daisy ? 0.1 + Math.random() * 0.1 : 0.12 + Math.random() * 0.25;
    dd[i * 4 + 1] = Math.random() * 6.283;
    dd[i * 4 + 2] = daisy ? 1 : 0;
    dd[i * 4 + 3] = 0.8 + Math.random() * 2.2;
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dgeo.setAttribute('aDot', new THREE.BufferAttribute(dd, 4));
  const dmat = new THREE.ShaderMaterial({
    vertexShader: DOT_VS, fragmentShader: DOT_FS, transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCalm: { value: calm }, uScale: { value: 300 } }
  });
  const dots = new THREE.Points(dgeo, dmat);
  dots.frustumCulled = false;
  scene.add(dots);

  /* pointer -> ground plane */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(up, 0), hit = new THREE.Vector3();
  const target = new THREE.Vector3(0, 0, 999);
  let pointerOn = 0, wantOn = 0;
  addEventListener('pointermove', (e) => {
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) { target.copy(hit); wantOn = 1; }
  }, { passive: true });
  addEventListener('pointerleave', () => { wantOn = 0; });

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, DPR_CAP);
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = innerWidth / innerHeight < 0.9 ? 60 : 42;
    camera.updateProjectionMatrix();
    dmat.uniforms.uScale.value = innerHeight * dpr * 0.55;
  }
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 120); });
  resize();

  let running = false, raf = 0, t0 = performance.now();
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
    resume() { if (running) return; running = true; canvas.style.display = ''; raf = requestAnimationFrame(frame); },
    pause() { running = false; cancelAnimationFrame(raf); canvas.style.display = 'none'; }
  };
  api.resume();
  return api;
}
