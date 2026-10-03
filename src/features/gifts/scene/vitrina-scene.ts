import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { IDSS_COLORS, type GiftCode } from "../catalogue";
import { UNBOXING, phase } from "../domain";
import { buildGift, buildPedestal, logoShape, type GiftModel } from "./models";

/**
 * The IDSS Vitrina scene (PDL-039): physically based rendering with image-based light from a generated room
 * environment, soft shadows, bloom, ACES tone mapping; one gift on its engraved pedestal, turntable and drag to rotate.
 * The unboxing: the wrapped box wobbles, the lid flies off, the IDSS logo shapes burst out and assemble the gift, a
 * light sweeps over it. Reduced motion: no animation, the finished gift. Runs only in the browser; no assets loaded.
 */

export type SceneOptions = { reducedMotion: boolean };
export type Engraving = { title: string; lines: string[] };

type Particle = { mesh: THREE.Mesh; from: THREE.Vector3; burst: THREE.Vector3; spin: THREE.Vector3 };

export class VitrinaScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private readonly controls: OrbitControls;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly clock = new THREE.Clock();
  private readonly stage = new THREE.Group();
  private readonly sweep = new THREE.SpotLight(0xffffff, 0, 12, Math.PI / 9, 0.6, 1);
  private model: GiftModel | null = null;
  private pedestal: THREE.Group | null = null;
  private unboxing: { start: number; box: THREE.Group; lid: THREE.Mesh; particles: Particle[]; done: () => void } | null = null;
  private frame = 0;
  private disposed = false;
  private readonly resizeObserver: ResizeObserver;

  constructor(private readonly host: HTMLElement, private readonly options: SceneOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.32;
    pmrem.dispose();
    this.scene.background = new THREE.Color("#0b1220");
    this.scene.fog = new THREE.Fog("#0b1220", 9, 22);

    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 4;
    const rimBlue = new THREE.PointLight(new THREE.Color(IDSS_COLORS.sky), 18, 12);
    rimBlue.position.set(-4, 3, -3);
    const rimYellow = new THREE.PointLight(new THREE.Color(IDSS_COLORS.yellow), 10, 10);
    rimYellow.position.set(4, 1.5, -2);
    this.sweep.position.set(-5, 5, 4);
    this.scene.add(key, rimBlue, rimYellow, this.sweep, this.sweep.target);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 64), new THREE.MeshStandardMaterial({ color: "#070c16", roughness: 0.55, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.42;
    floor.receiveShadow = true;
    this.scene.add(floor, this.stage);

    this.camera.position.set(0, 2.4, 6.4);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.9, 0);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 9;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.autoRotate = !options.reducedMotion;
    this.controls.autoRotateSpeed = 0.8;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.55, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.loop();
  }

  /** Shows one gift on its pedestal, without animation. */
  show(code: GiftCode, engraving: Engraving): void {
    this.cancelUnboxing();
    this.place(code, engraving);
    if (this.model) this.model.group.scale.setScalar(1);
  }

  /** Plays the unboxing, then calls `done`; with reduced motion it shows the gift at once. */
  unbox(code: GiftCode, engraving: Engraving, done: () => void): void {
    this.place(code, engraving);
    if (this.options.reducedMotion || !this.model) {
      done();
      return;
    }
    this.model.group.scale.setScalar(0.0001);
    if (this.pedestal) this.pedestal.visible = false;
    const box = new THREE.Group();
    const wrap = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(IDSS_COLORS.blue), roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });
    const ribbon = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(IDSS_COLORS.yellow), roughness: 0.3, metalness: 0.4, sheen: 1 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 1.5), wrap);
    body.position.y = 0.65;
    body.castShadow = true;
    const bandA = new THREE.Mesh(new THREE.BoxGeometry(1.52, 1.32, 0.22), ribbon);
    bandA.position.y = 0.65;
    const bandB = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.32, 1.52), ribbon);
    bandB.position.y = 0.65;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.3, 1.62), wrap);
    lid.position.y = 1.45;
    const bow = new THREE.Mesh(new THREE.TorusKnotGeometry(0.18, 0.06, 80, 10, 2, 3), ribbon);
    bow.position.y = 0.25;
    lid.add(bow);
    box.add(body, bandA, bandB, lid);
    this.stage.add(box);

    const kinds: Parameters<typeof logoShape>[0][] = ["square", "disc", "ring", "squareRing", "dot"];
    const hexes = [IDSS_COLORS.red, IDSS_COLORS.yellow, IDSS_COLORS.blue, IDSS_COLORS.sky];
    const particles: Particle[] = Array.from({ length: 56 }, (_, index) => {
      const mesh = logoShape(kinds[index % kinds.length], hexes[index % hexes.length], 0.22);
      const angle = (index / 56) * Math.PI * 2 * 3;
      const radius = 1.4 + (index % 7) * 0.22;
      const burst = new THREE.Vector3(Math.cos(angle) * radius, 1.2 + (index % 9) * 0.28, Math.sin(angle) * radius);
      mesh.visible = false;
      this.stage.add(mesh);
      return { mesh, from: new THREE.Vector3(0, 1.1, 0), burst, spin: new THREE.Vector3((index % 5) + 1, (index % 3) + 1, (index % 4) + 1) };
    });
    this.controls.autoRotate = false;
    this.unboxing = { start: this.clock.getElapsedTime(), box, lid, particles, done };
  }

  /** Skips the unboxing to its end. */
  skip(): void {
    if (!this.unboxing) return;
    this.unboxing.start = this.clock.getElapsedTime() - UNBOXING.sweepEnd;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          (material as THREE.MeshStandardMaterial).map?.dispose();
          material.dispose();
        });
      }
    });
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private place(code: GiftCode, engraving: Engraving): void {
    this.stage.clear();
    this.model = buildGift(code);
    this.model.group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = true;
    });
    this.pedestal = buildPedestal(engraving);
    this.pedestal.traverse((object) => {
      if (object instanceof THREE.Mesh) object.receiveShadow = true;
    });
    this.stage.add(this.pedestal, this.model.group);
  }

  private cancelUnboxing(): void {
    if (!this.unboxing) return;
    this.unboxing = null;
    this.controls.autoRotate = !this.options.reducedMotion;
  }

  private animateUnboxing(time: number): void {
    const run = this.unboxing;
    if (!run || !this.model) return;
    const t = time - run.start;
    const wobble = 1 - phase(t, UNBOXING.wobbleEnd - 0.2, UNBOXING.wobbleEnd);
    run.box.rotation.z = Math.sin(t * 14) * 0.06 * wobble;
    run.box.position.y = Math.abs(Math.sin(t * 7)) * 0.08 * wobble;
    const lid = phase(t, UNBOXING.wobbleEnd, UNBOXING.lidEnd);
    run.lid.position.y = 1.45 + lid * 3.2;
    run.lid.rotation.set(lid * 1.4, lid * 2.2, lid * 0.6);
    const shrink = 1 - phase(t, UNBOXING.lidEnd, UNBOXING.burstEnd);
    run.box.scale.setScalar(Math.max(shrink, 0.0001));

    const burst = phase(t, UNBOXING.lidEnd - 0.2, UNBOXING.burstEnd);
    const gather = phase(t, UNBOXING.burstEnd, UNBOXING.assembleEnd);
    const target = new THREE.Vector3(0, 1.1, 0);
    run.particles.forEach((particle, index) => {
      particle.mesh.visible = burst > 0 && gather < 1;
      const out = particle.from.clone().lerp(particle.burst, burst);
      const swirl = gather * Math.PI * 2 * (1 + (index % 3) * 0.3);
      const back = out.clone().lerp(target, gather);
      back.applyAxisAngle(new THREE.Vector3(0, 1, 0), swirl * (1 - gather));
      particle.mesh.position.copy(back);
      particle.mesh.rotation.set(t * particle.spin.x, t * particle.spin.y, t * particle.spin.z);
      particle.mesh.scale.setScalar(1 - gather * 0.9);
    });

    const grow = phase(t, UNBOXING.burstEnd + 0.6, UNBOXING.assembleEnd);
    const overshoot = grow < 1 ? grow * (1 + Math.sin(grow * Math.PI) * 0.18) : 1;
    this.model.group.scale.setScalar(Math.max(overshoot, 0.0001));
    if (this.pedestal) this.pedestal.visible = grow > 0.4;

    const sweep = phase(t, UNBOXING.assembleEnd - 0.4, UNBOXING.sweepEnd);
    this.sweep.intensity = Math.sin(sweep * Math.PI) * 60;
    this.sweep.position.set(-5 + sweep * 10, 5, 4);
    this.sweep.target.position.set(0, 1, 0);
    this.bloom.strength = 0.38 + Math.sin(sweep * Math.PI) * 0.8;

    if (t >= UNBOXING.sweepEnd) {
      const done = run.done;
      this.stage.remove(run.box);
      run.particles.forEach((particle) => this.stage.remove(particle.mesh));
      this.cancelUnboxing();
      this.sweep.intensity = 0;
      this.bloom.strength = 0.38;
      done();
    }
  }

  private resize(): void {
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    this.camera.aspect = width / height;
    // Portrait screens (phones): widen the view so the whole gift and its pedestal stay in frame.
    this.camera.fov = this.camera.aspect < 1 ? 38 / Math.max(this.camera.aspect, 0.45) : 38;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.bloom.setSize(width, height);
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    const time = this.clock.getElapsedTime();
    if (this.model && !this.options.reducedMotion) this.model.update(time);
    this.animateUnboxing(time);
    this.controls.update();
    this.composer.render();
  };
}

/** True when the browser can render WebGL; otherwise the page shows the gift as text and a still description. */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
