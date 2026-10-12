/* The crystal: a glass sphere whose interior is liquid light. One fragment shader on a small canvas,
   domain-warped noise drawn as thin glowing ribbons in cyan, violet and gold, refracted and rimmed like glass.
   Runs only while the ball is open. */
const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
const FS = `
precision highp float;
uniform vec2 uRes; uniform float uTime;
vec2 hash2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  float a = dot(hash2(i), vec2(0.5)), b = dot(hash2(i+vec2(1,0)), vec2(0.5)), c = dot(hash2(i+vec2(0,1)), vec2(0.5)), d = dot(hash2(i+vec2(1,1)), vec2(0.5));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(0.8, 0.6, -0.6, 0.8); for(int i=0;i<3;i++){ v += a*noise(p); p = m*p*1.9 + 1.7; a *= 0.45; } return v; }
float ribbon(float n, float w){ float d = abs(fract(n) - 0.5); return smoothstep(w, 0.0, d); }
void main(){
  vec2 uv = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  float r = length(uv);
  if (r > 1.0) { gl_FragColor = vec4(0.0); return; }
  float z = sqrt(1.0 - r*r);
  vec3 n = vec3(uv, z);
  /* refraction: look through the sphere, bending toward the centre */
  vec2 q = uv * (0.6 + 0.4 * z) * 1.1;
  float t = uTime * 0.07;
  /* slow swirl so the whole interior turns like liquid in a sphere */
  float ang = atan(q.y, q.x) + 0.7 * length(q) + t * 0.3;
  vec2 sq = length(q) * vec2(cos(ang), sin(ang));
  vec2 w1 = vec2(fbm(sq * 0.8 + vec2(t, -t*0.7)), fbm(sq * 0.8 + vec2(-t*0.6, t*0.9) + 4.2));
  vec2 w2 = vec2(fbm(sq * 0.8 + 1.8*w1 + vec2(1.3, 9.2) + t*0.3), fbm(sq * 0.8 + 1.8*w1 + vec2(8.3, 2.8) - t*0.2));
  float f  = fbm(sq * 0.7 + 1.6*w2);
  float f2 = fbm(sq * 1.0 - 1.4*w2 + vec2(t*0.5, 3.1));
  float f3 = fbm(sq * 0.5 + 1.2*w1 + vec2(-t*0.4, 7.7));
  vec3 base = vec3(0.02, 0.05, 0.19) + 0.25 * vec3(0.05, 0.12, 0.38) * f;
  /* many thin ribbons, each with a soft halo */
  float c1 = ribbon(f * 9.0 + t, 0.05),  h1 = ribbon(f * 9.0 + t, 0.22);
  float c2 = ribbon(f2 * 8.0 - t*1.1, 0.045), h2 = ribbon(f2 * 8.0 - t*1.1, 0.2);
  float c3 = ribbon(f3 * 7.0 + t*0.6, 0.04), h3 = ribbon(f3 * 7.0 + t*0.6, 0.18);
  vec3 cyan = vec3(0.3, 0.85, 1.0), violet = vec3(0.9, 0.4, 1.0), gold = vec3(1.0, 0.85, 0.45), blue = vec3(0.35, 0.5, 1.0);
  vec3 col = base;
  col += mix(cyan, blue, f2) * (pow(c1, 1.4) * 1.1 + pow(h1, 2.0) * 0.35);
  col += violet * (pow(c2, 1.4) * 1.0 + pow(h2, 2.0) * 0.3);
  col += gold * (pow(c3, 1.6) * 1.0 + pow(h3, 2.0) * 0.28);
  col += vec3(1.0) * (pow(c1, 6.0) + pow(c2, 6.0) + pow(c3, 6.0)) * 0.35;
  /* depth: brighter near the shell, dimmer in the middle */
  col *= 0.6 + 0.7 * (1.0 - z*z*0.55);
  /* glass shading */
  float fres = pow(1.0 - z, 2.4);
  col += vec3(0.6, 0.8, 1.0) * fres * 0.7;
  vec3 L = normalize(vec3(-0.55, 0.7, 0.6));
  float spec = pow(max(dot(n, L), 0.0), 60.0);
  col += vec3(1.0) * spec * 0.9;
  float spec2 = pow(max(dot(n, normalize(vec3(0.5, -0.45, 0.55))), 0.0), 40.0);
  col += vec3(1.0, 0.95, 0.85) * spec2 * 0.25;
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
  const uRes = gl.getUniformLocation(prog, 'uRes'), uTime = gl.getUniformLocation(prog, 'uTime');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.3 : 1;
  let running = false, raf = 0, t0 = 0;
  function size() {
    const px = Math.min(560, Math.round(canvas.clientWidth * Math.min(devicePixelRatio || 1, 1.5))) || 420;
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
    start() { if (running) return; running = true; t0 = performance.now() - (t0 ? 0 : 0); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); }
  };
}
