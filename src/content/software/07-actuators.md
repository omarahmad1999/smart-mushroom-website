---
order: 7
slug: actuators
title: Actuator Layer
tab: Actuators
icons: [toggle-right]
color: '#3FA56B'
---
### What it does

Converts software decisions into physical actions.

### How it works

Actuator services subscribe to MQTT command topics. The controller decides **what** should happen, while the actuator layer handles **how** the physical device is controlled.

### Output / Destination

Controls devices such as the exhaust fan and humidifier and records actuator events in the database.
