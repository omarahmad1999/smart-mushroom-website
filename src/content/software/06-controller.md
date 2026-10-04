---
order: 6
slug: controller
title: Environment Controller
tab: Controller
icons: [scales]
color: '#2E8784'
---
### What it does

Acts as the decision-making layer for environmental control.

### How it works

Subscribes to live MQTT sensor readings and compares them against the rules for the currently active growth phase. For example, low humidity can trigger a humidifier decision, while high temperature or CO₂ can trigger ventilation.

### Output / Destination

Publishes actuator commands through MQTT and records controller decisions in the database.
