/* The crystal: a glass sphere with liquid light inside, rendered as a real volume.
   For every pixel a ray enters the sphere, refracts, and marches through 3D noise; ribbons of cyan, violet and
   gold light are accumulated along the way, so the glow lines sit at different depths and shift with parallax
   as the interior turns. Glass shading (fresnel rim, two highlights) finishes the surface.
   Also exports curvedText(): letters placed on a cylinder in CSS 3D so a message wraps around the sphere. */
const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
const FS = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uQuality;
float hash3(vec3 p){ p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise3(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i), hash3(i+vec3(1,0,0)), f.x), mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x), mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm3(vec3 p){ float v = 0.0, a = 0.55; for(int i=0;i<3;i++){ v += a*noise3(p); p = p*1.9 + vec3(1.7, 9.2, 4.1); a *= 0.45; } return v; }
float ribbon(float n, float w){ float d = abs(fract(n) - 0.5); return smoothstep(w, 0.0, d); }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
void main(){
  vec2 uv = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  float r = length(uv);
  if (r > 1.0) { gl_FragColor = vec4(0.0); return; }
  float zf = sqrt(1.0 - r*r);
  vec3 n = vec3(uv, zf);
  vec3 rd = refract(vec3(0.0, 0.0, -1.0), n, 0.74);
  vec3 ro = n;
  float t = uTime * 0.07;
  int steps = int(14.0 + 10.0 * uQuality);
  float stepLen = 2.0 / float(steps);
  vec3 col = vec3(0.0);
  float acc = 0.0;
  vec3 cyan = vec3(0.3, 0.85, 1.0), violet = vec3(0.9, 0.4, 1.0), gold = vec3(1.0, 0.85, 0.45), blue = vec3(0.35, 0.5, 1.0);
  for (int i = 0; i < 24; i++) {
    if (i >= steps) break;
    float s = (float(i) + 0.5) * stepLen;
    vec3 p = ro + rd * s;
    if (dot(p, p) > 1.0) break;
    vec3 q = p * 1.5;
    q.xz = rot(t * 0.6 + p.y * 0.8) * q.xz;        /* the interior slowly turns, more at the top than the bottom */
    vec3 w = vec3(fbm3(q * 0.8 + vec3(t, -t*0.7, t*0.3)), fbm3(q * 0.8 + vec3(-t*0.6, t*0.9, 4.2)), fbm3(q * 0.8 + vec3(2.0, 7.0, -t*0.5)));
    float f  = fbm3(q * 0.7 + 1.6 * w);
    float f2 = fbm3(q * 1.0 - 1.3 * w + vec3(t*0.5, 3.1, 0.0));
    float f3 = fbm3(q * 0.5 + 1.1 * w.zxy + vec3(-t*0.4, 7.7, 1.3));
    float c1 = ribbon(f * 3.2 + t, 0.06),  h1 = ribbon(f * 3.2 + t, 0.2);
    float c2 = ribbon(f2 * 2.8 - t*1.1, 0.055), h2 = ribbon(f2 * 2.8 - t*1.1, 0.18);
    float c3 = ribbon(f3 * 2.4 + t*0.6, 0.05), h3 = ribbon(f3 * 2.4 + t*0.6, 0.16);
    vec3 e = mix(cyan, blue, f2) * (pow(c1, 1.4) * 1.0 + pow(h1, 2.0) * 0.3)
           + violet * (pow(c2, 1.4) * 0.95 + pow(h2, 2.0) * 0.28)
           + gold * (pow(c3, 1.6) * 0.9 + pow(h3, 2.0) * 0.25)
           + vec3(1.0) * (pow(c1, 6.0) + pow(c2, 6.0) + pow(c3, 6.0)) * 0.3;
    float dens = clamp((c1 + c2 + c3) * 0.7, 0.0, 1.0);
    float depthFade = 1.0 - 0.5 * s;              /* light further inside is dimmer, so nearer ribbons read in front */
    col += e * stepLen * 2.8 * (1.0 - acc) * depthFade;
    acc += dens * stepLen * 2.4;
    acc = min(acc, 0.95);
  }
  col += vec3(0.02, 0.05, 0.19) * (1.0 - acc) * 1.4;      /* the deep navy body */
  col += vec3(0.03, 0.08, 0.3) * (1.0 - zf) * 0.5;
  /* glass */
  float fres = pow(1.0 - zf, 2.4);
  col += vec3(0.6, 0.8, 1.0) * fres * 0.75;
  vec3 L = normalize(vec3(-0.55, 0.7, 0.6));
  col += vec3(1.0) * pow(max(dot(n, L), 0.0), 70.0) * 0.95;
  col += vec3(1.0, 0.95, 0.85) * pow(max(dot(n, normalize(vec3(0.5, -0.45, 0.55))), 0.0), 40.0) * 0.25;
  float edge = smoothstep(1.0, 0.985, r);
  gl_FragColor = vec4(col * edge, edge);
}`;

export function createCrystal(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return null;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'uRes'), uTime = gl.getUniformLocation(prog, 'uTime'), uQ = gl.getUniformLocation(prog, 'uQuality');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.3 : 1;
  const mobile = /Mobi|Android/i.test(navigator.userAgent);
  gl.uniform1f(uQ, mobile ? 0.3 : 1.0);
  let running = false, raf = 0, t0 = 0;
  function size() {
    const px = Math.min(mobile ? 360 : 480, Math.round(canvas.clientWidth * Math.min(devicePixelRatio || 1, 1.25))) || 400;
    if (canvas.width !== px) { canvas.width = canvas.height = px; gl.viewport(0, 0, px, px); gl.uniform2f(uRes, px, px); }
  }
  function frame(now) {
    if (!running) return;
    size();
    gl.uniform1f(uTime, ((now - t0) / 1000) * calm + 11.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  }
  return {
    start() { if (running) return; running = true; t0 = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); }
  };
}

/* lay a line of text on a cylinder of radius R px, centred on the viewer; each letter turns around the Y axis */
export function curvedText(el, text, R) {
  el.innerHTML = '';
  const chars = [...String(text)];
  const spans = chars.map((ch) => { const s = document.createElement('span'); s.textContent = ch === ' ' ? ' ' : ch; el.appendChild(s); return s; });
  const widths = spans.map((s) => s.getBoundingClientRect().width || 10);
  const total = widths.reduce((a, b) => a + b, 0);
  const maxArc = Math.PI * 0.78 * R;                    /* never wrap past the visible front of the sphere */
  const scale = total > maxArc ? maxArc / total : 1;
  let x = -total * scale / 2;
  spans.forEach((s, i) => {
    const w = widths[i] * scale;
    const theta = (x + w / 2) / R;                       /* radians around the cylinder */
    s.style.transform = 'translate(-50%, -50%) rotateY(' + (theta * 180 / Math.PI).toFixed(2) + 'deg) translateZ(' + R + 'px) scale(' + scale.toFixed(3) + ')';
    x += w;
  });
}
