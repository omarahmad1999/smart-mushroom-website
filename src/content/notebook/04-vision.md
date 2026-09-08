---
order: 4
slug: vision
tab: Vision Lab
kicker: From an image to a question
title: What does the camera see?
image: /media/photo-incubation-2026-09-04.webp
alt: Unannotated experiment photograph captured on 4 September 2026, with no model detections added.
caption: A camera still, before any interpretation · 4 September 2026
source: Actual photograph · not a YOLO prediction
scribble: Seeing is not the same as understanding.
note: A prediction needs its own evidence.
annotation: This is an original observation image, not a detection example. Genuine model outputs can be added here when available.
x: 55
y: 45
reference: computer-vision
---
The computer-vision work asks whether a model can recognize mushrooms in images of the growing space.

### Trained, with more work ahead

A **YOLOv8s** model has been trained with *mushroom* as its primary class. The project brief reports approximately **0.9443 mAP50** in model evaluation.

That result does not establish reliability in the deployed tent. Edge inference using the Pi AI HAT 2 and Hailo-10H is planned; the complete camera-to-inference pipeline is not documented as deployed.

### Still to investigate

How do lighting, overlapping clusters, and changes in viewpoint affect predictions? Counting and growth tracking need their own evaluation.
