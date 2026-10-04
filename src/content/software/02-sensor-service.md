---
order: 2
slug: sensor-service
title: Python Sensor Service
tab: Python service
icons: [python]
color: '#4b82b3'
---
### What it does

Converts raw sensor communication into usable software data.

### How it works

A Python service periodically reads each sensor over I²C, identifies its location/device, packages the measurements and prepares them for the rest of the system.

### Output / Destination

Publishes sensor readings to **MQTT topics**.
