"use client";

import { useEffect, useRef, type RefObject } from "react";

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
  uniform sampler2D u_videoA;
  uniform sampler2D u_videoB;
  uniform vec2 u_resolution;
  uniform vec2 u_sizeA;
  uniform vec2 u_sizeB;
  uniform vec2 u_pointer;
  uniform float u_local;

  vec2 coverUv(vec2 uv, vec2 textureSize) {
    float screenAspect = u_resolution.x / max(u_resolution.y, 1.0);
    float textureAspect = textureSize.x / max(textureSize.y, 1.0);
    vec2 cover = vec2(1.0);
    if (screenAspect > textureAspect) cover.y = textureAspect / screenAspect;
    else cover.x = screenAspect / textureAspect;
    return (uv - 0.5) * cover + 0.5;
  }

  void main() {
    float pulse = sin(u_local * 3.14159265);
    float zoom = 1.0 + pulse * 0.022;
    vec2 baseUv = (v_uv - 0.5) / zoom + 0.5;
    float edgeDepth = smoothstep(0.10, 0.72, distance(v_uv, vec2(0.5)) * 1.38);
    baseUv += u_pointer * (0.004 + edgeDepth * 0.012);

    vec3 colorA = texture2D(u_videoA, coverUv(baseUv, u_sizeA)).rgb;
    vec3 colorB = texture2D(u_videoB, coverUv(baseUv, u_sizeB)).rgb;

    // The source showcase's diagonal right-to-left chapter wipe.
    float tilt = 0.115 * (v_uv.y - 0.5);
    float boundary = 1.08 - u_local * 1.16 + tilt;
    float mask = smoothstep(boundary - 0.022, boundary + 0.022, v_uv.x);
    vec3 color = mix(colorA, colorB, mask);
    float seam = exp(-abs(v_uv.x - boundary) * 82.0) * pulse;
    color += vec3(0.82, 0.67, 0.42) * seam * 0.08;
    gl_FragColor = vec4(color, 1.0);
  }
`;

function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const value = gl.createShader(type);
  if (!value) return null;
  gl.shaderSource(value, source);
  gl.compileShader(value);
  if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) {
    gl.deleteShader(value);
    return null;
  }
  return value;
}

function makeTexture(gl: WebGLRenderingContext, unit: number) {
  const texture = gl.createTexture();
  gl.activeTexture(unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([5, 7, 11, 255]),
  );
  return texture;
}

type Props = {
  activeIndex: number;
  videosRef: RefObject<Array<HTMLVideoElement | null>>;
};

type TransitionState = {
  from: number;
  to: number;
  startedAt: number;
  duration: number;
};

const easeInOutCubic = (value: number) => (
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2
);

export default function VideoWipeCanvas({ activeIndex, videosRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transitionRef = useRef<TransitionState>({
    from: activeIndex,
    to: activeIndex,
    startedAt: -1,
    duration: 1050,
  });

  useEffect(() => {
    const previous = transitionRef.current;
    const now = performance.now();
    const elapsed = previous.startedAt < 0 ? 1 : (now - previous.startedAt) / previous.duration;
    const dominantFrame = easeInOutCubic(Math.min(1, Math.max(0, elapsed))) >= 0.5
      ? previous.to
      : previous.from;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    transitionRef.current = {
      from: dominantFrame,
      to: activeIndex,
      startedAt: dominantFrame === activeIndex ? -1 : 0,
      duration: reducedMotion ? 1 : 1050,
    };
  }, [activeIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    const vertex = shader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = shader(gl, gl.FRAGMENT_SHADER, fragmentSource);
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

    const textureA = makeTexture(gl, gl.TEXTURE0);
    const textureB = makeTexture(gl, gl.TEXTURE1);
    const uniforms = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      sizeA: gl.getUniformLocation(program, "u_sizeA"),
      sizeB: gl.getUniformLocation(program, "u_sizeB"),
      pointer: gl.getUniformLocation(program, "u_pointer"),
      local: gl.getUniformLocation(program, "u_local"),
      videoA: gl.getUniformLocation(program, "u_videoA"),
      videoB: gl.getUniformLocation(program, "u_videoB"),
    };
    gl.uniform1i(uniforms.videoA, 0);
    gl.uniform1i(uniforms.videoB, 1);

    let frame = 0;
    let lowerIndex = -1;
    let upperIndex = -1;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const move = (event: PointerEvent) => {
      pointer.tx = event.clientX / window.innerWidth - 0.5;
      pointer.ty = 0.5 - event.clientY / window.innerHeight;
    };
    window.addEventListener("pointermove", move, { passive: true });

    const resetTexture = (texture: WebGLTexture | null, unit: number) => {
      gl.activeTexture(unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([5, 7, 11, 255]),
      );
    };

    const render = () => {
      const videos = videosRef.current ?? [];
      const transition = transitionRef.current;
      const from = Math.min(4, Math.max(0, transition.from));
      const to = Math.min(4, Math.max(0, transition.to));
      const videoA = videos[from];
      const videoB = videos[to];
      const readyA = Boolean(videoA && videoA.readyState >= 2 && videoA.videoWidth > 0);
      const readyB = Boolean(videoB && videoB.readyState >= 2 && videoB.videoWidth > 0);
      let local = from === to ? 1 : 0;

      if (from !== to && readyA && readyB) {
        const now = performance.now();
        if (transition.startedAt === 0) transition.startedAt = now;
        const elapsed = Math.min(1, Math.max(0, (now - transition.startedAt) / transition.duration));
        local = easeInOutCubic(elapsed);
        if (elapsed >= 1) {
          transition.from = transition.to;
          transition.startedAt = -1;
        }
      }

      const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
      const width = Math.round(canvas.clientWidth * ratio);
      const height = Math.round(canvas.clientHeight * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (readyA) {
        if (from !== lowerIndex) {
          lowerIndex = from;
          resetTexture(textureA, gl.TEXTURE0);
        }
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textureA);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoA!);
        } catch {
          frame = requestAnimationFrame(render);
          return;
        }
      }

      if (readyB) {
        if (to !== upperIndex) {
          upperIndex = to;
          resetTexture(textureB, gl.TEXTURE1);
        }
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textureB);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoB!);
        } catch {
          frame = requestAnimationFrame(render);
          return;
        }
      } else if (readyA) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textureB);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoA!);
      }

      if (readyA) {
        pointer.x += (pointer.tx - pointer.x) * 0.045;
        pointer.y += (pointer.ty - pointer.y) * 0.045;
        gl.uniform2f(uniforms.resolution, width, height);
        gl.uniform2f(uniforms.sizeA, videoA!.videoWidth, videoA!.videoHeight);
        gl.uniform2f(
          uniforms.sizeB,
          readyB ? videoB!.videoWidth : videoA!.videoWidth,
          readyB ? videoB!.videoHeight : videoA!.videoHeight,
        );
        gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
        gl.uniform1f(uniforms.local, local);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      gl.deleteTexture(textureA);
      gl.deleteTexture(textureB);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [videosRef]);

  return <canvas className="video-wipe-canvas" ref={canvasRef} aria-hidden="true" />;
}
