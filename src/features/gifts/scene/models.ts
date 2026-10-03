import * as THREE from "three";
import { IDSS_COLORS, type GiftCode } from "../catalogue";

/**
 * The six gifts as procedural 3D models (PDL-039, G6: free models designed by us). Everything is built from three.js
 * geometry and physically based materials; there are no model files and no external assets. Each builder returns a
 * group centred at the origin, about two units tall, standing on y = 0, and an `update` for idle motion.
 */

export type GiftModel = { group: THREE.Group; update: (time: number) => void };

const color = (hex: string) => new THREE.Color(hex);

const gold = () => new THREE.MeshPhysicalMaterial({ color: color("#d9a93a"), metalness: 1, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15 });
const brass = () => new THREE.MeshPhysicalMaterial({ color: color("#c79a3b"), metalness: 1, roughness: 0.32 });
const enamel = (hex: string) => new THREE.MeshPhysicalMaterial({ color: color(hex), metalness: 0.1, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
const glow = (hex: string, intensity = 1.6) => new THREE.MeshStandardMaterial({ color: color(hex), emissive: color(hex), emissiveIntensity: intensity, roughness: 0.4 });

/** One shape of the IDSS logo: square, disc, ring, square ring or dot. */
export function logoShape(kind: "square" | "disc" | "ring" | "squareRing" | "dot", hex: string, size = 0.42): THREE.Mesh {
  const depth = size * 0.28;
  const material = enamel(hex);
  switch (kind) {
    case "square":
      return new THREE.Mesh(new THREE.BoxGeometry(size, size, depth), material);
    case "disc":
      return new THREE.Mesh(new THREE.CylinderGeometry(size / 2, size / 2, depth, 40).rotateX(Math.PI / 2), material);
    case "dot":
      return new THREE.Mesh(new THREE.CylinderGeometry(size / 4, size / 4, depth, 32).rotateX(Math.PI / 2), material);
    case "ring":
      return new THREE.Mesh(new THREE.TorusGeometry(size * 0.36, size * 0.12, 20, 48), material);
    case "squareRing": {
      const outer = new THREE.Shape();
      const half = size / 2;
      outer.moveTo(-half, -half).lineTo(half, -half).lineTo(half, half).lineTo(-half, half).lineTo(-half, -half);
      const inner = new THREE.Path();
      const hole = size * 0.26;
      inner.moveTo(-hole, -hole).lineTo(-hole, hole).lineTo(hole, hole).lineTo(hole, -hole).lineTo(-hole, -hole);
      outer.holes.push(inner);
      const geometry = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: false });
      geometry.translate(0, 0, -depth / 2);
      return new THREE.Mesh(geometry, material);
    }
  }
}

/** The 4 x 4 IDSS logo mark, row by row from the top (as in the official logo). */
const LOGO: [Parameters<typeof logoShape>[0], string][][] = [
  [["square", "#141414"], ["disc", IDSS_COLORS.red], ["ring", IDSS_COLORS.yellow], ["dot", IDSS_COLORS.blue]],
  [["disc", IDSS_COLORS.sky], ["squareRing", IDSS_COLORS.blue], ["disc", IDSS_COLORS.blue], ["disc", IDSS_COLORS.red]],
  [["disc", IDSS_COLORS.blue], ["disc", IDSS_COLORS.blue], ["squareRing", IDSS_COLORS.yellow], ["disc", IDSS_COLORS.sky]],
  [["square", IDSS_COLORS.sky], ["ring", IDSS_COLORS.yellow], ["disc", IDSS_COLORS.blue], ["dot", IDSS_COLORS.blue]],
];

function crystal(): GiftModel {
  const group = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2, 1, 1, 1),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, thickness: 1.2, roughness: 0.04, ior: 1.52, metalness: 0, clearcoat: 1, attenuationColor: color("#dff3ff"), attenuationDistance: 3 }),
  );
  glass.position.y = 1.05;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.01, 2.01, 2.01)), new THREE.LineBasicMaterial({ color: color("#e9f6ff"), transparent: true, opacity: 0.55 }));
  edges.position.copy(glass.position);
  const mark = new THREE.Group();
  LOGO.forEach((row, r) => row.forEach(([kind, hex], c) => {
    const piece = logoShape(kind, hex, 0.36);
    piece.position.set((c - 1.5) * 0.42, (1.5 - r) * 0.42, 0);
    mark.add(piece);
  }));
  mark.position.y = 1.05;
  group.add(glass, edges, mark);
  return { group, update: (time) => { mark.rotation.y = Math.sin(time * 0.6) * 0.35; } };
}

function icosahedron(): GiftModel {
  const group = new THREE.Group();
  const solid = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 0), gold());
  (solid.material as THREE.MeshPhysicalMaterial).flatShading = true;
  solid.position.y = 1.15;
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.965, 0)), new THREE.LineBasicMaterial({ color: color("#fff1c2") }));
  frame.position.copy(solid.position);
  group.add(solid, frame);
  return { group, update: (time) => { solid.rotation.set(time * 0.25, time * 0.4, 0); frame.rotation.copy(solid.rotation); solid.position.y = frame.position.y = 1.15 + Math.sin(time * 1.2) * 0.06; } };
}

function quillBook(): GiftModel {
  const group = new THREE.Group();
  const cover = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.7), enamel(IDSS_COLORS.blue));
  cover.position.y = 0.3;
  const paper = new THREE.MeshPhysicalMaterial({ color: color("#e9e0c8"), roughness: 0.85, sheen: 0.3 });
  const left = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.16, 1.58), paper);
  left.position.set(-0.58, 0.42, 0);
  left.rotation.z = 0.12;
  const right = left.clone();
  right.position.x = 0.58;
  right.rotation.z = -0.12;
  const page = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.5, 12, 1), new THREE.MeshPhysicalMaterial({ color: color("#efe7d2"), roughness: 0.8, side: THREE.DoubleSide }));
  page.rotation.x = -Math.PI / 2;
  page.position.set(0.55, 0.52, 0);
  const pageHinge = new THREE.Group();
  pageHinge.position.set(0, 0.52, 0);
  page.position.set(0.55, 0, 0);
  pageHinge.add(page);
  const quill = new THREE.Group();
  const feather = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16).scale(0.16, 0.85, 0.035), new THREE.MeshPhysicalMaterial({ color: color("#eef7ff"), roughness: 0.4, sheen: 1, sheenColor: color(IDSS_COLORS.sky), emissive: color(IDSS_COLORS.sky), emissiveIntensity: 0.15 }));
  feather.position.y = 0.55;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.006, 1.45, 12), gold());
  shaft.position.y = 0.35;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 12).rotateX(Math.PI), gold());
  tip.position.y = -0.42;
  const aura = new THREE.PointLight(color(IDSS_COLORS.sky), 0.8, 2.2);
  aura.position.y = 0.5;
  quill.add(feather, shaft, tip, aura);
  quill.position.set(0.25, 1.35, 0.15);
  quill.rotation.set(0.25, 0, -0.55);
  group.add(cover, left, right, pageHinge, quill);
  return { group, update: (time) => { pageHinge.rotation.z = 0.2 + (Math.sin(time * 0.9) * 0.5 + 0.5) * 2.6; quill.position.y = 1.35 + Math.sin(time * 1.4) * 0.08; } };
}

function key(): GiftModel {
  const group = new THREE.Group();
  const cushion = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24).scale(1.35, 0.32, 0.95),
    new THREE.MeshPhysicalMaterial({ color: color("#7a0f14"), roughness: 0.85, sheen: 1, sheenColor: color("#ff8a8f"), sheenRoughness: 0.4 }),
  );
  cushion.position.y = 0.32;
  const keyGroup = new THREE.Group();
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.085, 24, 64), brass());
  bow.position.x = -0.85;
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 16, 48), brass());
  inner.position.x = -0.85;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.55, 24).rotateZ(Math.PI / 2), brass());
  shaft.position.x = 0.22;
  const bitA = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.08), brass());
  bitA.position.set(0.82, -0.18, 0);
  const bitB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.08), brass());
  bitB.position.set(0.6, -0.13, 0);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), enamel(IDSS_COLORS.sky));
  gem.position.x = -0.85;
  keyGroup.add(bow, inner, shaft, bitA, bitB, gem);
  keyGroup.position.y = 0.78;
  keyGroup.rotation.x = -Math.PI / 2.4;
  group.add(cushion, keyGroup);
  return { group, update: (time) => { keyGroup.position.y = 0.78 + Math.sin(time * 1.1) * 0.05; gem.rotation.y = time; } };
}

function persistence(): GiftModel {
  const group = new THREE.Group();
  const geometry = new THREE.ConeGeometry(1.35, 1.9, 9, 4);
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    if (y < 0.94 && y > -0.94) {
      const jitter = 1 + Math.sin(index * 12.9898) * 0.08;
      position.setX(index, position.getX(index) * jitter);
      position.setZ(index, position.getZ(index) * jitter);
    }
  }
  geometry.computeVertexNormals();
  const rock = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: color("#2c4560"), roughness: 0.9, flatShading: true }));
  rock.position.y = 0.95;
  const snow = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.6, 9, 1), new THREE.MeshStandardMaterial({ color: color("#f4f8ff"), roughness: 0.5, flatShading: true }));
  snow.position.y = 1.62;
  const peak = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), glow(IDSS_COLORS.yellow, 2.4));
  peak.position.y = 2.02;
  const light = new THREE.PointLight(color(IDSS_COLORS.yellow), 1.6, 2.5);
  light.position.y = 2.05;
  const path = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.025, 8, 80, Math.PI * 1.6), glow(IDSS_COLORS.sky, 1.2));
  path.rotation.x = Math.PI / 2;
  path.position.y = 0.55;
  group.add(rock, snow, peak, light, path);
  return { group, update: (time) => { peak.rotation.y = time * 1.5; light.intensity = 1.4 + Math.sin(time * 2) * 0.5; path.rotation.z = time * 0.3; } };
}

function spark(): GiftModel {
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 3), glow("#fff3c4", 2));
  core.position.y = 1.15;
  const light = new THREE.PointLight(color("#fff1c0"), 2, 3);
  light.position.copy(core.position);
  const orbit = new THREE.Group();
  orbit.position.copy(core.position);
  const hexes = [IDSS_COLORS.red, IDSS_COLORS.yellow, IDSS_COLORS.blue, IDSS_COLORS.sky];
  hexes.forEach((hex, index) => {
    const satellite = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), glow(hex, 1.4));
    const angle = (index / hexes.length) * Math.PI * 2;
    satellite.position.set(Math.cos(angle) * 0.85, Math.sin(angle * 2) * 0.2, Math.sin(angle) * 0.85);
    orbit.add(satellite);
  });
  group.add(core, light, orbit);
  return { group, update: (time) => { orbit.rotation.y = time * 0.9; orbit.rotation.x = Math.sin(time * 0.5) * 0.3; core.scale.setScalar(1 + Math.sin(time * 3) * 0.06); orbit.children.forEach((child) => { child.rotation.x = time * 2; child.rotation.y = time * 1.5; }); } };
}

const BUILDERS: Record<GiftCode, () => GiftModel> = { crystal, icosahedron, quill_book: quillBook, key, persistence, spark };

/** Builds the gift's model. */
export function buildGift(code: GiftCode): GiftModel {
  return BUILDERS[code]();
}

/** The dark stone pedestal with a gold rim and the engraved plaque (teacher, date, message drawn into a texture). */
export function buildPedestal(engraving: { title: string; lines: string[] }): THREE.Group {
  const group = new THREE.Group();
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.6, 0.42, 72), new THREE.MeshPhysicalMaterial({ color: color("#0f1622"), roughness: 0.5, metalness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.35 }));
  stone.position.y = -0.21;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.025, 12, 128), gold());
  rim.rotation.x = Math.PI / 2;
  const stripe = new THREE.Group();
  const hexes = [IDSS_COLORS.red, IDSS_COLORS.yellow, IDSS_COLORS.blue, IDSS_COLORS.sky];
  hexes.forEach((hex, index) => {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(1.57, 0.02, 8, 64, (Math.PI * 2) / 4.4), glow(hex, 0.6));
    arc.rotation.x = Math.PI / 2;
    arc.rotation.z = (index / 4) * Math.PI * 2;
    stripe.add(arc);
  });
  stripe.position.y = -0.36;

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#121a26";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#d9a93a";
    context.lineWidth = 6;
    context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
    context.fillStyle = "#f2d27a";
    context.textAlign = "center";
    context.font = "700 54px system-ui, sans-serif";
    context.fillText(engraving.title, canvas.width / 2, 96, canvas.width - 80);
    context.fillStyle = "#e9eef6";
    context.font = "400 38px system-ui, sans-serif";
    engraving.lines.slice(0, 4).forEach((line, index) => context.fillText(line, canvas.width / 2, 170 + index * 52, canvas.width - 80));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5625), new THREE.MeshStandardMaterial({ map: texture, metalness: 0.3, roughness: 0.5 }));
  plaque.position.set(0, -0.2, 1.62);
  plaque.rotation.x = -0.18;
  plaque.name = "plaque";
  group.add(stone, rim, stripe, plaque);
  return group;
}
