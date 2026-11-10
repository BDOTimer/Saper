import * as THREE from 'three';
import { TILE } from './renderer.js';

const WATER_VERTEX_SHADER = `
varying vec3 vWorldPos;

void main() {
  vec3 transformed = position;
  vec4 worldPos = vec4(transformed, 1.0);

  #ifdef USE_INSTANCING
    worldPos = instanceMatrix * worldPos;
  #endif

  worldPos = modelMatrix * worldPos;
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const WATER_FRAGMENT_SHADER = `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uCrest;
uniform vec3 uFoam;

varying vec3 vWorldPos;

float wave(vec2 p, float t, vec2 w) {
  float a = sin(dot(p, vec2( 0.86,  0.51)) * 1.85 + w.x * 1.70 + t * 1.05);
  float b = sin(dot(p, vec2(-0.42,  0.91)) * 2.60 + w.y * 1.45 - t * 1.30);
  float c = sin(dot(p, vec2( 0.62, -0.78)) * 3.40 + w.x * 1.10 + t * 1.80);
  float d = sin(dot(p, vec2( 0.20,  0.98)) * 1.30 + w.y * 1.90 - t * 0.85);
  return a * 0.40 + b * 0.30 + c * 0.18 + d * 0.12;
}

void main() {
  vec2 p = vWorldPos.xz;
  float t = uTime;

  vec2 warp = vec2(
    sin(p.y * 1.35 + t * 0.70),
    cos(p.x * 1.15 - t * 0.60)
  );

  float h = wave(p, t, warp);
  float detail = sin(p.x * 6.0 + warp.y * 1.7 + t * 2.1)
               * sin(p.y * 4.3 - warp.x * 1.3 - t * 1.6);
  detail = detail * 0.5 + 0.5;

  vec3 color = mix(uDeep, uMid, smoothstep(-0.55, 0.75, h));
  float crest = smoothstep(0.40, 0.95, h);
  color = mix(color, uCrest, crest * 0.30);
  color = mix(color, uFoam, smoothstep(0.82, 1.00, h) * 0.12);
  color += uFoam * pow(detail, 12.0) * 0.05;

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - clamp(viewDir.y, 0.0, 1.0), 4.0);
  color = mix(color, uCrest, fresnel * 0.08);

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class WaterView {
  constructor(mapView) {
    this.mapView = mapView;
    this.scene = mapView.scene;
    this.mesh = null;
    this.enabled = true;
  }

  rebuild() {
    this.destroy();

    const cells = this.mapView.world?.cells?.filter(c => c?.meta?.isWater) ?? [];
    if (!cells.length) return;

    const geometry = new THREE.PlaneGeometry(TILE, TILE, 1, 1);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(0x061b33) },
        uMid: { value: new THREE.Color(0x0b3e5e) },
        uCrest: { value: new THREE.Color(0x2f89a8) },
        uFoam: { value: new THREE.Color(0xa8d6de) },
      },
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: WATER_FRAGMENT_SHADER,
    });

    const mesh = new THREE.InstancedMesh(geometry, material, cells.length);
    mesh.name = 'WaterMesh';
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    const dummy = new THREE.Object3D();
    cells.forEach((cell, i) => {
      dummy.position.set(
        this.mapView._worldX(cell.x),
        this.mapView._worldY(cell) + 0.17,
        this.mapView._worldZ(cell.y)
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.visible = this.enabled;

    this.mesh = mesh;
    this.scene.add(mesh);
  }

  setEnabled(enabled) {
    this.enabled = enabled !== false;
    if (this.mesh) this.mesh.visible = this.enabled;
  }

  update(dt) {
    const uniforms = this.mesh?.material?.uniforms;
    if (!uniforms || !this.mesh.visible) return;
    const step = (dt || 0) * 0.001;
    uniforms.uTime.value = (uniforms.uTime.value + step) % 1000;
  }

  destroy() {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    this.mesh.geometry?.dispose?.();
    this.mesh.material?.dispose?.();
    this.mesh.dispose?.();
    this.mesh = null;
  }
}
