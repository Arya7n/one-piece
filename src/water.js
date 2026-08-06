import * as THREE from 'three'

/**
 * Animated ocean: multi-wave displacement + fresnel color + sparkle.
 * `sampleWaveHeight(x, z, t)` matches the vertex shader so ships can bob.
 */

const WAVE_A = [
  { amp: 0.28, len: 18, speed: 1.1, dir: [1, 0.35] },
  { amp: 0.16, len: 9.5, speed: 1.6, dir: [-0.7, 0.8] },
  { amp: 0.1, len: 5.2, speed: 2.2, dir: [0.4, -1] },
  { amp: 0.06, len: 3.1, speed: 2.8, dir: [-0.9, -0.4] },
]

function waveContribution(x, z, t, w) {
  const dx = w.dir[0]
  const dz = w.dir[1]
  const len = Math.hypot(dx, dz) || 1
  const nx = dx / len
  const nz = dz / len
  const k = (Math.PI * 2) / w.len
  const phase = k * (nx * x + nz * z) - w.speed * t
  return Math.sin(phase) * w.amp
}

/** World-space wave height at (x,z) — keep in sync with vertex shader. */
export function sampleWaveHeight(x, z, t) {
  let h = 0
  for (const w of WAVE_A) h += waveContribution(x, z, t, w)
  return h
}

export function createOceanWater() {
  // High-res disc so waves read clearly near shore and ship
  const geo = new THREE.CircleGeometry(250, 160)
  // CircleGeometry is in XY; rotate later to XZ. Need enough verts for waves.
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    uniforms: {
      uTime: { value: 0 },
      uNight: { value: 0 },
      uDive: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.4, 0.85, 0.25).normalize() },
      uDeep: { value: new THREE.Color(0x0a3d62) },
      uMid: { value: new THREE.Color(0x1485b8) },
      uShallow: { value: new THREE.Color(0x4ec7e0) },
      uSpecular: { value: new THREE.Color(0xe8f7ff) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vWave;

      float wave(vec2 p, float amp, float len, float speed, vec2 dir) {
        vec2 d = normalize(dir);
        float k = 6.28318530718 / len;
        float phase = k * dot(d, p) - speed * uTime;
        return sin(phase) * amp;
      }

      float heightAt(vec2 p) {
        float h = 0.0;
        h += wave(p, 0.28, 18.0, 1.1, vec2(1.0, 0.35));
        h += wave(p, 0.16, 9.5, 1.6, vec2(-0.7, 0.8));
        h += wave(p, 0.10, 5.2, 2.2, vec2(0.4, -1.0));
        h += wave(p, 0.06, 3.1, 2.8, vec2(-0.9, -0.4));
        return h;
      }

      void main() {
        vec3 pos = position;
        // After mesh Rx=-90°, local (x,y) → world (x, -y) on XZ
        vec2 xz = vec2(pos.x, -pos.y);
        float h = heightAt(xz);
        pos.z += h; // local +Z → world +Y

        float e = 0.45;
        float hx = heightAt(xz + vec2(e, 0.0)) - heightAt(xz - vec2(e, 0.0));
        float hz = heightAt(xz + vec2(0.0, e)) - heightAt(xz - vec2(0.0, e));
        // Normal in local space (Z up before rotation)
        vec3 nLocal = normalize(vec3(-hx / (2.0 * e), hz / (2.0 * e), 1.0));

        vec4 world = modelMatrix * vec4(pos, 1.0);
        vWorldPos = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * nLocal);
        vWave = h;

        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uNight;
      uniform float uDive;
      uniform vec3 uSunDir;
      uniform vec3 uDeep;
      uniform vec3 uMid;
      uniform vec3 uShallow;
      uniform vec3 uSpecular;

      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vWave;

      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.8);

        // Depth cue from distance to origin (archipelago center)
        float dist = length(vWorldPos.xz);
        float depthMix = smoothstep(30.0, 160.0, dist);
        vec3 base = mix(uShallow, uMid, smoothstep(-0.15, 0.25, vWave));
        base = mix(base, uDeep, depthMix * 0.75);

        // Night darken
        base = mix(base, base * 0.35 + vec3(0.02, 0.05, 0.12), uNight);

        // Specular sun glitter
        vec3 R = reflect(-normalize(uSunDir), N);
        float spec = pow(max(dot(R, V), 0.0), 48.0);
        float sparkle = pow(max(dot(N, normalize(uSunDir)), 0.0), 12.0);
        vec3 col = base;
        col += uSpecular * (spec * 0.55 + sparkle * 0.12) * (1.0 - uNight * 0.7);
        col = mix(col, uSpecular * 0.85, fresnel * 0.35 * (1.0 - uNight * 0.5));

        // Soft foam on wave peaks
        float foam = smoothstep(0.22, 0.38, vWave);
        col = mix(col, vec3(0.85, 0.95, 1.0), foam * 0.35 * (1.0 - uNight));

        float alpha = mix(0.78, 0.92, fresnel);
        alpha = mix(alpha, 0.96, uDive);
        col = mix(col, vec3(0.02, 0.1, 0.18), uDive * 0.55);

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
      mat.uniforms.uDive.value = dive ? 1 : 0
      if (sunDir) mat.uniforms.uSunDir.value.copy(sunDir).normalize()
    },
  }
}
