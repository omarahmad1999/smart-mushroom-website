import * as THREE from 'three';

// Small live effects for the devices: mist from the humidifier, the cameras' flash and the LEDs' pool of light.
// Each is a pure function of its own progress, so pausing, seeking and replaying stay exact.

/** A soft round spot, shared by every effect. */
let spot: THREE.CanvasTexture | undefined;
function softSpot() {
  if (spot) return spot;
  const element = document.createElement('canvas'); element.width = element.height = 64;
  const context = element.getContext('2d')!, gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.45, 'rgba(255,255,255,.55)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
  spot = new THREE.CanvasTexture(element);
  return spot;
}

export type Mist = ReturnType<typeof createMist>;
/** Puffs of mist rising from the humidifier's nozzle, one after another for a couple of seconds. */
export function createMist(origin: THREE.Vector3, puffs = 9) {
  const group = new THREE.Group();
  const sprites = Array.from({ length: puffs }, (_, i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSpot(), color: '#e3edf2', transparent: true, depthWrite: false, opacity: 0 }));
    sprite.visible = false; sprite.renderOrder = 4; group.add(sprite);
    return { sprite, start: i * .2, drift: new THREE.Vector3(Math.sin(i * 2.4) * .12, 0, Math.cos(i * 2.4) * .12) };
  });
  const life = 1.5;
  return {
    group, duration: (puffs - 1) * .2 + life,
    /** `t`: seconds since the mist began; below zero, nothing shows. */
    set(t: number) {
      for (const { sprite, start, drift } of sprites) {
        const age = t - start, on = age > 0 && age < life;
        sprite.visible = on;
        if (!on) continue;
        const k = age / life;
        sprite.position.copy(origin).addScaledVector(drift, k).setY(origin.y + .05 + .7 * k);
        sprite.scale.setScalar(.16 + .42 * k);
        sprite.material.opacity = .7 * Math.sin(Math.PI * k) ** 1.4;
      }
    },
    dispose() { for (const { sprite } of sprites) sprite.material.dispose(); },
  };
}

/** Light falling from the LED bar onto what grows below: a soft, widening cone that faces the viewer. */
export function createBeam(top: THREE.Vector3, bottom: THREE.Vector3, width: number, color: string) {
  const element = document.createElement('canvas'); element.width = 64; element.height = 128;
  const context = element.getContext('2d')!, gradient = context.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, 'rgba(255,255,255,.9)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.beginPath(); context.moveTo(20, 0); context.lineTo(44, 0); context.lineTo(64, 128); context.lineTo(0, 128); context.closePath(); context.fill();
  const texture = new THREE.CanvasTexture(element);
  const material = new THREE.SpriteMaterial({ map: texture, color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(top).lerp(bottom, .5); sprite.scale.set(width, top.y - bottom.y, 1);
  sprite.renderOrder = 5; sprite.visible = false;
  return {
    object: sprite,
    set(level: number) { sprite.visible = level > .005; material.opacity = level; },
    dispose() { material.dispose(); texture.dispose(); },
  };
}

export type Glow = ReturnType<typeof createGlow>;
/** A soft light: a halo (the cameras' flash) or a pool lying on a surface (the LEDs' light on their platform).
 *  The page behind is pale paper, where added light would barely show, so the glow is painted on instead. */
export function createGlow(at: THREE.Vector3, color: string, size: number, lying = false) {
  const options = { map: softSpot(), color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false };
  const material = lying ? new THREE.MeshBasicMaterial(options) : new THREE.SpriteMaterial(options);
  const object = lying ? new THREE.Mesh(new THREE.PlaneGeometry(size, size), material) : new THREE.Sprite(material as THREE.SpriteMaterial);
  if (lying) object.rotation.x = -Math.PI / 2; else object.scale.setScalar(size);
  object.position.copy(at); object.renderOrder = 5; object.visible = false;
  return {
    object,
    /** 0 is off; 1 is full. A halo also swells a little as it brightens. */
    set(level: number) {
      object.visible = level > .005; material.opacity = level;
      if (!lying) object.scale.setScalar(size * (.6 + .4 * level));
    },
    dispose() { material.dispose(); if (object instanceof THREE.Mesh) object.geometry.dispose(); },
  };
}
