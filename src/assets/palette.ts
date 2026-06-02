// Dark gothic color palette. Cold desaturated stone, dried blood, sickly
// green, bone, and warm torch light. Helpers produce light/shadow ramps so the
// iso prisms read with consistent lighting (top brightest, left mid, right dark).

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function rgb(r: number, g: number, b: number): RGB {
  return { r, g, b };
}

export function css(c: RGB, a = 1): string {
  return `rgba(${c.r | 0}, ${c.g | 0}, ${c.b | 0}, ${a})`;
}

export function shade(c: RGB, factor: number): RGB {
  return rgb(
    Math.max(0, Math.min(255, c.r * factor)),
    Math.max(0, Math.min(255, c.g * factor)),
    Math.max(0, Math.min(255, c.b * factor)),
  );
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return rgb(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

// Lighting factors for the three faces of an iso prism.
export const FACE_TOP = 1.0;
export const FACE_LEFT = 0.66;
export const FACE_RIGHT = 0.44;

export const PALETTE = {
  // Stone floor
  floor: rgb(58, 56, 62),
  floorAlt: rgb(46, 45, 52),
  floorCrack: rgb(28, 27, 32),
  moss: rgb(54, 70, 48),

  // Walls
  wall: rgb(74, 70, 66),
  wallDark: rgb(40, 38, 36),
  wallMortar: rgb(28, 26, 25),

  // Blood / accents
  blood: rgb(120, 22, 22),
  bloodDark: rgb(70, 12, 12),

  // Bone / undead
  bone: rgb(206, 198, 178),
  boneShadow: rgb(150, 142, 122),

  // Flesh (zombie)
  rot: rgb(96, 120, 78),
  rotDark: rgb(60, 78, 48),

  // Player
  cloak: rgb(70, 32, 96),
  cloakDark: rgb(44, 18, 64),
  steel: rgb(150, 158, 170),
  steelDark: rgb(92, 98, 110),
  skin: rgb(196, 156, 128),

  // Torch / fire / magic
  torch: rgb(255, 168, 64),
  torchCore: rgb(255, 232, 170),
  magic: rgb(120, 180, 255),
  magicCore: rgb(220, 240, 255),

  // Items
  potionRed: rgb(190, 30, 40),
  potionBlue: rgb(40, 90, 200),
  gold: rgb(220, 180, 70),

  // Misc
  black: rgb(8, 7, 9),
  shadow: rgb(0, 0, 0),
} as const;
