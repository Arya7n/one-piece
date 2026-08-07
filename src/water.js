import * as THREE from 'three'
import { WORLD } from './world.js'

/**
 * Animated ocean: Gerstner swells + chop, fresnel, foam, glitter.
 * `sampleWaveHeight(x, z, t)` must stay in sync with the vertex shader height.
 */

/** amp, wavelength, speed, direction, steepness Q (0–1) */
const WAVE_A = [
  { amp: 0.42, len: 48, speed: 0.75, dir: [1.0, 0.28], q: 0.55 },
  { amp: 0.28, len: 31, speed: 0.95, dir: [-0.55, 0.85], q: 0.5 },
  { amp: 0.18, len: 17, speed: 1.35, dir: [0.72, -0.68], q: 0.45 },
  { amp: 0.11, len: 9.5, speed: 1.85, dir: [-0.9, -0.35], q: 0.4 },
  { amp: 0.07, len: 5.4, speed: 2.4, dir: [0.25, 1.0], q: 0.35 },
  { amp: 0.04, len: 3.2, speed: 3.1, dir: [-0.65, 0.75], q: 0.3 },
]

function dirNorm(dir) {
  const len = Math.hypot(dir[0], dir[1]) || 1
  return [dir[0] / len, dir[1] / len]
}

/** Vertical Gerstner height for ship / camera bob. */
export function sampleWaveHeight(x, z, t) {
  let h = 0
  for (const w of WAVE_A) {
    const [nx, nz] = dirNorm(w.dir)
    const k = (Math.PI * 2) / w.len
    const phase = k * (nx * x + nz * z) - w.speed * t
    h += Math.cos(phase) * w.amp
  }
  return h
}

function waveTableGLSL() {
  return WAVE_A.map(
    (w, i) =>
      `waves[${i}] = Wave(${w.amp.toFixed(3)}, ${w.len.toFixed(2)}, ${w.speed.toFixed(2)}, vec2(${w.dir[0].toFixed(3)}, ${w.dir[1].toFixed(3)}), ${w.q.toFixed(2)});`,
  ).join('\n        ')
}

export function createOceanWater() {
  const geo = new THREE.CircleGeometry(WORLD.sailRadius + 40, 220)
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    uniforms: {
      uTime: { value: 0 },
      uNight: { value: 0 },
      uDive: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.4, 0.85, 0.25).normalize() },
      uDeep: { value: new THREE.Color(0x062a45) },
      uMid: { value: new THREE.Color(0x0e6f9c) },
      uShallow: { value: new THREE.Color(0x3db8d0) },
      uSpecular: { value: new THREE.Color(0xf2fbff) },
      uFoam: { value: new THREE.Color(0xdcefff) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vWave;
      varying float vCrest;

      struct Wave {
        float amp;
        float len;
        float speed;
        vec2 dir;
        float q;
      };

      const int WAVE_COUNT = 6;

      void fillWaves(inout Wave waves[6]) {
        ${waveTableGLSL()}
      }

      // Accumulate Gerstner in world XZ with Y-up; returns displacement (dx, dy, dz)
      vec3 gerstnerSum(vec2 p, out vec3 normal, out float crest) {
        vec3 disp = vec3(0.0);
        // Start with flat basis (Y-up)
        vec3 tx = vec3(1.0, 0.0, 0.0);
        vec3 tz = vec3(0.0, 0.0, 1.0);
        crest = 0.0;
        Wave waves[6];
        fillWaves(waves);

        for (int i = 0; i < WAVE_COUNT; i++) {
          Wave w = waves[i];
          vec2 d = normalize(w.dir);
          float k = 6.28318530718 / w.len;
          float phase = k * dot(d, p) - w.speed * uTime;
          float c = cos(phase);
          float s = sin(phase);
          float qa = clamp(w.q, 0.0, 1.0) * w.amp;

          disp.x += d.x * qa * c;
          disp.y += w.amp * c;
          disp.z += d.y * qa * c;

          tx += vec3(-d.x * d.x * qa * k * s, d.x * w.amp * k * c, -d.x * d.y * qa * k * s);
          tz += vec3(-d.x * d.y * qa * k * s, d.y * w.amp * k * c, -d.y * d.y * qa * k * s);

          crest += w.amp * max(c, 0.0);
        }

        normal = normalize(cross(tz, tx));
        if (normal.y < 0.0) normal = -normal;
        return disp;
      }

      void main() {
        vec3 pos = position;
        // Circle in XY; after Rx=-90° local (x,-y) → world (x,z)
        vec2 xz = vec2(pos.x, -pos.y);

        vec3 nWorldYUp;
        float crest;
        vec3 disp = gerstnerSum(xz, nWorldYUp, crest);

        // Map Y-up displacement into local mesh (Z-up before rotation)
        pos.x += disp.x;
        pos.y -= disp.z;
        pos.z += disp.y;

        // Map Y-up normal → local Z-up
        vec3 nLocal = vec3(nWorldYUp.x, -nWorldYUp.z, nWorldYUp.y);

        vec4 world = modelMatrix * vec4(pos, 1.0);
        vWorldPos = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * nLocal);
        vWave = disp.y;
        vCrest = crest;

        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uNight;
      uniform float uDive;
      uniform vec3 uSunDir;
      uniform vec3 uDeep;
      uniform vec3 uMid;
      uniform vec3 uShallow;
      uniform vec3 uSpecular;
      uniform vec3 uFoam;

      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vWave;
      varying float vCrest;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        float ndotv = max(dot(N, V), 0.0);
        float fresnel = pow(1.0 - ndotv, 3.2);

        float dist = length(vWorldPos.xz);
        float depthMix = smoothstep(40.0, 280.0, dist);

        float hMix = smoothstep(-0.35, 0.4, vWave);
        vec3 base = mix(uDeep * 1.05, uMid, hMix);
        base = mix(base, uShallow, hMix * hMix * 0.55);
        base = mix(base, uDeep, depthMix * 0.82);

        float wrap = max(dot(N, L) * 0.5 + 0.5, 0.0);
        base += vec3(0.02, 0.08, 0.07) * wrap * (1.0 - depthMix) * 0.45;
        base = mix(base, base * 0.32 + vec3(0.015, 0.04, 0.1), uNight);

        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 96.0);
        float glitter = pow(max(dot(N, L), 0.0), 18.0);
        float sparkNoise = hash(floor(vWorldPos.xz * 0.55 + uTime * 0.15));
        sparkNoise = mix(sparkNoise, hash(floor(vWorldPos.xz * 1.1 + vCrest * 4.0)), 0.45);
        float sparkle = glitter * step(0.82, sparkNoise) * 0.55;

        vec3 col = base;
        col += uSpecular * (spec * 0.7 + sparkle * 0.35) * (1.0 - uNight * 0.75);
        col = mix(col, uSpecular * 0.9, fresnel * 0.42 * (1.0 - uNight * 0.45));

        float steep = 1.0 - clamp(N.y, 0.0, 1.0);
        float foam = smoothstep(0.35, 0.85, vCrest) * 0.65;
        foam += smoothstep(0.12, 0.35, steep) * 0.4;
        foam = clamp(foam, 0.0, 1.0) * mix(1.0, 0.35, depthMix);
        col = mix(col, uFoam, foam * 0.55 * (1.0 - uNight * 0.6));

        float alpha = mix(0.82, 0.94, fresnel);
        alpha = mix(alpha, 0.97, uDive);
        col = mix(col, vec3(0.015, 0.08, 0.14), uDive * 0.58);

        gl_FragColor = vec4(col, alpha);
      }
    `,
  })

  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.02
  mesh.receiveShadow = true
  mesh.name = 'Ocean'

  return {
    mesh,
    material: mat,
    update(t, { night = 0, dive = false, sunDir = null } = {}) {
      mat.uniforms.uTime.value = t
      mat.uniforms.uNight.value = night
      const target = dive ? 1 : 0
      mat.uniforms.uDive.value += (target - mat.uniforms.uDive.value) * 0.12
      if (sunDir) mat.uniforms.uSunDir.value.copy(sunDir).normalize()
    },
  }
}
