---
order: 1
slug: sensor-acquisition
title: Sensor Data Acquisition
tab: Sensors
icons: [thermometer, cloud]
color: '#e5484d'
---
### What it does

Collects environmental data from inside the Mushroom Hub and from the surrounding room.

### How it works

Two sensor pairs are used: **SHT31** for temperature/humidity and **SCD41** for CO₂. They communicate with the Raspberry Pi over **I²C**. SHT31 addresses can be changed, but SCD41 sensors share a fixed address, so the pairs are separated across different I²C buses. WAGO connectors are used to organize/distribute the wiring.

### Output / Destination

Temperature, humidity and CO₂ readings are passed to the Python sensor service.
