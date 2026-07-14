"use client";

import { useEffect, useRef } from "react";

const vertexSource = `
  precision highp float;
  attribute vec2 a_uv;
  varying vec2 v_uv;
  uniform vec2 u_planeScale;
  uniform float u_progress;
  uniform float u_character;

  const float PI = 3.14159265359;

  float band(float value, float start, float end, float feather) {
    return smoothstep(start, start + feather, value)
      * (1.0 - smoothstep(end - feather, end, value));
  }

  float region(vec2 uv, vec4 bounds, float feather) {
    return band(uv.x, bounds.x, bounds.z, feather)
      * band(uv.y, bounds.y, bounds.w, feather);
  }

  vec2 rotateAround(vec2 point, vec2 pivot, float angle) {
    float cosine = cos(angle);
    float sine = sin(angle);
    vec2 offset = point - pivot;
    return pivot + vec2(
      offset.x * cosine - offset.y * sine,
      offset.x * sine + offset.y * cosine
    );
  }

  void main() {
    float travel = smoothstep(0.04, 0.84, u_progress);
    float reach = smoothstep(0.10, 0.68, u_progress);
    float counter = sin(travel * PI);
    float finger = pow(max(0.0, 1.0 - abs(u_progress - 0.53) / 0.15), 2.0);
    float tail = sin(travel * PI * 2.0);
    vec2 deformed = a_uv;
    float scale = 1.0;
    float angle = 0.0;
    vec2 translation = vec2(0.0);

    if (u_character < 0.5) {
      // Protect the head, glasses and face from every local deformation.
      float faceProtection = 1.0 - region(a_uv, vec4(0.29, 0.08, 0.60, 0.50), 0.025);

      float reachArm = region(a_uv, vec4(0.45, 0.47, 0.70, 0.66), 0.035) * faceProtection;
      vec2 reachPose = rotateAround(deformed, vec2(0.49, 0.535), -0.048 * reach);
      reachPose.x += 0.0085 * reach;
      deformed = mix(deformed, reachPose, reachArm);

      float fingers = region(a_uv, vec4(0.625, 0.49, 0.70, 0.615), 0.018);
      vec2 fingerPose = rotateAround(deformed, vec2(0.625, 0.55), 0.035 * finger);
      deformed = mix(deformed, fingerPose, fingers);

      float rearArm = region(a_uv, vec4(0.225, 0.415, 0.415, 0.62), 0.03) * faceProtection;
      vec2 rearPose = rotateAround(deformed, vec2(0.385, 0.505), 0.032 * counter);
      deformed = mix(deformed, rearPose, rearArm);

      float frontLeg = region(a_uv, vec4(0.20, 0.59, 0.42, 0.88), 0.035);
      vec2 frontLegPose = rotateAround(deformed, vec2(0.385, 0.65), -0.05 * counter);
      deformed = mix(deformed, frontLegPose, frontLeg);

      float backLeg = region(a_uv, vec4(0.34, 0.59, 0.515, 0.86), 0.032);
      vec2 backLegPose = rotateAround(deformed, vec2(0.43, 0.65), 0.043 * counter);
      deformed = mix(deformed, backLegPose, backLeg);

      scale = 0.90;
      angle = -0.0183 * travel;
      translation = vec2(-0.29 - 0.064 * travel, -0.036 + 0.034 * counter);
    } else {
      // The face remains rigid while the paw deforms below the muzzle.
      float faceProtection = 1.0 - region(a_uv, vec4(0.355, 0.20, 0.615, 0.535), 0.025);

      float reachPaw = region(a_uv, vec4(0.215, 0.505, 0.615, 0.735), 0.035) * faceProtection;
      vec2 pawPose = rotateAround(deformed, vec2(0.57, 0.59), 0.035 * reach);
      pawPose.x -= 0.012 * reach;
      deformed = mix(deformed, pawPose, reachPaw);

      float frontLeg = region(a_uv, vec4(0.505, 0.565, 0.655, 0.91), 0.035);
      vec2 frontLegPose = rotateAround(deformed, vec2(0.585, 0.63), -0.038 * counter);
      deformed = mix(deformed, frontLegPose, frontLeg);

      float hindLegs = region(a_uv, vec4(0.65, 0.55, 0.875, 0.83), 0.038);
      vec2 hindPose = rotateAround(deformed, vec2(0.72, 0.64), 0.034 * counter);
      deformed = mix(deformed, hindPose, hindLegs);

      float tailRegion = region(a_uv, vec4(0.715, 0.10, 0.88, 0.535), 0.03);
      vec2 tailPose = rotateAround(deformed, vec2(0.755, 0.45), -0.058 * reach + 0.022 * tail);
      deformed = mix(deformed, tailPose, tailRegion);

      scale = 0.78;
      angle = 0.0192 * travel;
      translation = vec2(0.40 + 0.076 * travel, -0.02 - 0.018 * counter);
    }

    vec2 clip = vec2(
      (deformed.x * 2.0 - 1.0) * u_planeScale.x,
      (1.0 - deformed.y * 2.0) * u_planeScale.y
    );
    clip *= scale;
    clip = rotateAround(clip, vec2(0.0), angle);
    clip += translation;

    v_uv = a_uv;
    gl_Position = vec4(clip, 0.0, 1.0);
  }
`;

const fragmentSource = `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_texture;
  uniform float u_etch;

  void main() {
    vec4 color = texture2D(u_texture, v_uv);
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(color.rgb, vec3(luminance), u_etch);
    color.rgb *= 1.0 - u_etch * 0.22;
    gl_FragColor = color;
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
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

function createTexture(gl: WebGLRenderingContext, source: string) {
  const texture = gl.createTexture();
  const state = { texture, ready: false };
  gl.bindTexture(gl.TEXTURE_2D, texture);
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
    new Uint8Array([0, 0, 0, 0]),
  );

  const image = new Image();
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // UV coordinates are authored top-down to match the source artwork.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    state.ready = true;
  };
  image.src = source;
  return state;
}

type Props = {
  progress: number;
};

export default function CharacterMotionCanvas({ progress }: Props) {
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
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const columns = 72;
    const rows = 40;
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let row = 0; row <= rows; row += 1) {
      for (let column = 0; column <= columns; column += 1) {
        vertices.push(column / columns, row / rows);
      }
    }
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const topLeft = row * (columns + 1) + column;
        const topRight = topLeft + 1;
        const bottomLeft = topLeft + columns + 1;
        const bottomRight = bottomLeft + 1;
        indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
      }
    }

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    const uvLocation = gl.getAttribLocation(program, "a_uv");
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    const uniforms = {
      planeScale: gl.getUniformLocation(program, "u_planeScale"),
      progress: gl.getUniformLocation(program, "u_progress"),
      character: gl.getUniformLocation(program, "u_character"),
      texture: gl.getUniformLocation(program, "u_texture"),
      etch: gl.getUniformLocation(program, "u_etch"),
    };
    gl.uniform1i(uniforms.texture, 0);

    const male = createTexture(gl, "/assets/hero-layers/male.png");
    const cat = createTexture(gl, "/assets/hero-layers/cat.png");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const textureAspect = 1672 / 941;
    let frame = 0;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const render = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const screenAspect = width / height;
      let planeX = 1.06;
      let planeY = 1.06;
      if (screenAspect > textureAspect) planeY *= screenAspect / textureAspect;
      else planeX *= textureAspect / screenAspect;

      const currentProgress = prefersReducedMotion.matches
        ? 0
        : Math.min(1, Math.max(0, progressRef.current));
      const etchIn = Math.min(1, Math.max(0, (currentProgress - 0.4) / 0.21));
      const etchOut = Math.min(1, Math.max(0, (currentProgress - 0.73) / 0.2));
      const etch = etchIn * etchIn * (3 - 2 * etchIn)
        * (1 - etchOut * etchOut * (3 - 2 * etchOut));

      gl.uniform2f(uniforms.planeScale, planeX, planeY);
      gl.uniform1f(uniforms.progress, currentProgress);
      gl.uniform1f(uniforms.etch, etch);
      gl.activeTexture(gl.TEXTURE0);

      if (male.ready) {
        gl.bindTexture(gl.TEXTURE_2D, male.texture);
        gl.uniform1f(uniforms.character, 0);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      }
      if (cat.ready) {
        gl.bindTexture(gl.TEXTURE_2D, cat.texture);
        gl.uniform1f(uniforms.character, 1);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      }

      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      gl.deleteTexture(male.texture);
      gl.deleteTexture(cat.texture);
      gl.deleteBuffer(vertexBuffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, []);

  return <canvas className="character-motion-canvas" ref={canvasRef} aria-hidden="true" />;
}
