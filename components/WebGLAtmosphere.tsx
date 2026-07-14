"use client";

import { useEffect, useRef } from "react";

const vertexSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentSource = `
  precision highp float;
  varying vec2 v_uv;
  uniform vec2 u_resolution;
  uniform vec2 u_pointer;
  uniform float u_time;
  uniform float u_progress;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
  }

  void main() {
    vec2 uv = v_uv;
    vec2 aspect = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
    vec2 p = (uv - 0.5) * aspect;
    p += u_pointer * 0.014;

    float enter = smoothstep(0.30, 0.58, u_progress);
    float leave = 1.0 - smoothstep(0.82, 1.02, u_progress);
    float etch = enter * leave;

    vec2 gridUv = uv * vec2(12.0, 7.0);
    vec2 gridCell = abs(fract(gridUv) - 0.5);
    float grid = 1.0 - smoothstep(0.492, 0.5, max(gridCell.x, gridCell.y));

    float angle = atan(p.y, p.x);
    float radius = length(p);
    float swirl = noise(p * 5.5 + vec2(cos(angle), sin(angle)) * u_time * 0.12);
    float nebula = (1.0 - smoothstep(0.12, 0.72, radius)) * smoothstep(0.33, 0.82, swirl);

    vec2 cells = floor(uv * u_resolution / 4.0);
    float seed = hash(cells + floor(u_time * 7.0));
    float dust = step(0.988 - etch * 0.055, seed);
    dust *= 1.0 - smoothstep(0.05, 0.72, radius + noise(p * 8.0) * 0.25);

    vec2 starUv = uv * vec2(56.0, 32.0);
    vec2 starId = floor(starUv);
    vec2 starPos = fract(starUv) - 0.5;
    float starSeed = hash(starId);
    float star = step(0.965, starSeed) * (1.0 - smoothstep(0.0, 0.085, length(starPos)));
    star *= 0.55 + 0.45 * sin(u_time * (2.0 + starSeed * 3.0) + starSeed * 31.0);

    float ring = 1.0 - smoothstep(0.0, 0.012, abs(radius - (0.17 + 0.03 * sin(u_time * 0.7))));
    ring *= etch * 0.6;

    vec3 cool = vec3(0.31, 0.56, 0.78);
    vec3 gold = vec3(1.0, 0.74, 0.30);
    vec3 color = mix(cool, gold, smoothstep(0.1, 0.8, uv.y + nebula));
    float alpha = grid * etch * 0.035;
    alpha += star * etch * 0.34;
    alpha += dust * etch * 0.42;
    alpha += nebula * etch * 0.11;
    alpha += ring * 0.16;
    alpha = min(alpha, 0.48);

    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

function makeShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export default function WebGLAtmosphere({ progress }: { progress: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    const vertex = makeShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = makeShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, "u_resolution");
    const timeUniform = gl.getUniformLocation(program, "u_time");
    const progressUniform = gl.getUniformLocation(program, "u_progress");
    const pointerUniform = gl.getUniformLocation(program, "u_pointer");
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let frame = 0;

    const move = (event: PointerEvent) => {
      pointer.tx = event.clientX / window.innerWidth - 0.5;
      pointer.ty = 0.5 - event.clientY / window.innerHeight;
    };
    window.addEventListener("pointermove", move, { passive: true });

    const render = (time: number) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.round(canvas.clientWidth * ratio);
      const height = Math.round(canvas.clientHeight * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(resolution, width, height);
      gl.uniform2f(pointerUniform, pointer.x, pointer.y);
      gl.uniform1f(timeUniform, time * 0.001);
      gl.uniform1f(progressUniform, progressRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, []);

  return <canvas className="webgl-atmosphere" ref={canvasRef} aria-hidden="true" />;
}
