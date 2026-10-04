---
order: 7
slug: lessons
tab: What Went Wrong
kicker: Leave room for the inconvenient parts
title: Keep the crossed-out ideas.
image: /media/hardware-setup.webp
alt: The supplied hardware workbench photograph, illustrating the interconnected equipment discussed in the reliability notes.
caption: Connected equipment, shared points of failure
source: Hardware reference photograph · not an incident capture
scribble: A restart ≠ a recovery.
note: Missing observations are observations about the system.
annotation: This photograph provides hardware context only. It is not evidence of the sensor failure described on the facing page.
x: 66
y: 72
reference: limitations
---
By **31 August 2026**, the investigation found that sensor records had stopped after 24 August. Repeated SCD41 initialization failures appeared to terminate the shared publisher, interrupting the other sensors too.

### What that taught us

**Isolate failures.** One unavailable sensor should not silence the rest of the observations.

**Check the outcome.** A running process is not proof of recovery. Restarting the camera timer also once caused an unexpected extra capture.

**Keep uncertainty visible.** Missing records and unfinished integrations belong beside the successful parts of the build.

These are historical notes, not current service status.
