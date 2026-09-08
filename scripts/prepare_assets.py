#!/usr/bin/env python3
"""Prepare the supplied illustrations for the static site without altering originals.

Requires Pillow, numpy and OpenCV. Bag matting is local; no external image service
or runtime image processing is involved. All output is authored, static media.
"""

from pathlib import Path
import json

import cv2
import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "media_for_astro_website"
DEST = ROOT / "public" / "media"
DEST.mkdir(parents=True, exist_ok=True)

FILES = {
    "tent-frame.webp": "pvc_structure_4.png",
    **{f"frame-{i}.webp": f"pvc_structure_{i}.png" for i in range(1, 5)},
    "cover-front.webp": "front_side_plastic.png",
    "cover-left.webp": "left_side_transparent_plastic.png",
    "cover-right.webp": "right_side_transparent_plastic.png",
    "cover-top.webp": "top_side_transparent_plastic.png",
    "humidifier.webp": "humidifier.png",
    "duct.webp": "humidifer_duct.png",
    "fan.webp": "fan.png",
    "camera.webp": "pi_camera.png",
    "sensor-sht.webp": "sht31_large.png",
    "sensor-co2.webp": "scd_41_large.png",
    "pi.webp": "raspberry_pi_large.png",
    "led-on.webp": "led_on.png",
    "led-off.webp": "led_off.png",
    "vent.webp": "air_vent.png",
}


def alpha_bounds(im, threshold=2):
    alpha = np.asarray(im.getchannel("A"))
    ys, xs = np.where(alpha > threshold)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def padded_bounds(box, size, padding=3):
    x0, y0, x1, y1 = box
    return max(0, x0-padding), max(0, y0-padding), min(size[0], x1+padding), min(size[1], y1+padding)


def export(im, filename, max_dimension=1600):
    im.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
    im.save(DEST / filename, "WEBP", quality=91, method=6, exact=True)
    return {"width": im.width, "height": im.height, "bytes": (DEST / filename).stat().st_size}


def bag_cutout(path):
    """Remove only the white exterior and cord-loop opening, retaining highlights.

    Interior white areas are intentionally opaque so the bag retains the original
    illustrator's specular highlights. A narrow edge matte removes the white halo.
    """
    rgb = np.array(Image.open(path).convert("RGB"))
    height, width = rgb.shape[:2]
    white = (rgb.min(axis=2) > 242).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(white, connectivity=8)
    border_labels = np.unique(np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1])))
    # The cord's enclosed opening is background too, although not edge-connected.
    loop_label = labels[round(height * .085), round(width * .496)]
    background_labels = set(int(label) for label in border_labels if label != 0)
    if loop_label:
        background_labels.add(int(loop_label))
    foreground = (~np.isin(labels, list(background_labels))).astype(np.uint8)
    # Retain the main object only; eliminate isolated off-white background flecks.
    _, components, component_stats, _ = cv2.connectedComponentsWithStats(foreground, connectivity=8)
    largest = 1 + np.argmax(component_stats[1:, cv2.CC_STAT_AREA])
    foreground = (components == largest).astype(np.uint8)
    distance = cv2.distanceTransform(foreground, cv2.DIST_L2, 5)
    core = (distance >= 2.2).astype(np.uint8)
    # Find the nearest solid pixel for a narrow white-background decontamination.
    _, nearest = cv2.distanceTransformWithLabels(1-core, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    core_colours = rgb[core.astype(bool)].astype(np.float32)
    nearest_colour = core_colours[np.maximum(nearest - 1, 0)]
    observed = rgb.astype(np.float32)
    delta = 255.0 - nearest_colour
    numerator = ((255.0 - observed) * delta).sum(axis=2)
    denominator = (delta * delta).sum(axis=2)
    fraction = np.clip(numerator / np.maximum(denominator, 1.0), 0, 1)
    alpha = np.where(core, 1.0, fraction * foreground)
    edge = (foreground == 1) & (core == 0)
    colour = observed.copy()
    colour[edge] = np.clip((observed[edge] - 255.0 * (1-alpha[edge, None])) / np.maximum(alpha[edge, None], .01), 0, 255)
    return Image.fromarray(np.dstack((colour.astype(np.uint8), (alpha*255).astype(np.uint8))), "RGBA")


def prepare_bags():
    report = {}
    sources = {
        "bag-bare.webp": SOURCE / "generated/mushroom_bags/hanging_bag_without_mushrooms_v1.png",
        "bag-oyster.webp": SOURCE / "generated/mushroom_bags/hanging_bag_oyster_mushrooms_v1.png",
    }
    bags = {
        name: bag_cutout(source) for name, source in sources.items()
    }
    # Both illustrations share the same mouth shape. Its common silhouette
    # preserves a near-white fold that touches the exterior in one variant.
    common_alpha = np.maximum.reduce([np.asarray(im.getchannel("A")) for im in bags.values()])
    for name, im in bags.items():
        rgba = np.array(im)
        original_rgb = np.array(Image.open(sources[name]).convert("RGB"))
        restore = np.zeros(rgba.shape[:2], dtype=bool)
        restore[235:345] = common_alpha[235:345] > rgba[235:345, :, 3]
        rgba[restore, :3] = original_rgb[restore]
        rgba[restore, 3] = common_alpha[restore]
        bags[name] = Image.fromarray(rgba, "RGBA")
    bounds = [alpha_bounds(im) for im in bags.values()]
    # Shared crop preserves registration for a bare-to-fruiting crossfade.
    union = (min(b[0] for b in bounds), min(b[1] for b in bounds), max(b[2] for b in bounds), max(b[3] for b in bounds))
    crop = padded_bounds(union, next(iter(bags.values())).size, 4)
    for name, im in bags.items():
        im = im.crop(crop)
        report[name] = {"source_crop": list(crop), **export(im, name, max_dimension=1500)}
    return report


def main():
    report = {}
    for output, source in FILES.items():
        im = Image.open(SOURCE / source).convert("RGBA")
        crop = padded_bounds(alpha_bounds(im), im.size)
        report[output] = {"source": source, "source_crop": list(crop), **export(im.crop(crop), output)}
    report.update(prepare_bags())

    setup = ImageOps.exif_transpose(Image.open(SOURCE / "hardware_setup.jpeg")).convert("RGB")
    setup = setup.transpose(Image.Transpose.ROTATE_270)
    report["hardware-setup.webp"] = export(setup, "hardware-setup.webp")
    mosfet = ImageOps.exif_transpose(Image.open(SOURCE / "mosfet.jpg")).convert("RGB")
    report["mosfet-photo.webp"] = export(mosfet, "mosfet-photo.webp", max_dimension=1600)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
