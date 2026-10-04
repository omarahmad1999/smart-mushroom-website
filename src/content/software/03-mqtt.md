---
order: 3
slug: mqtt
title: MQTT Messaging Layer
tab: MQTT
icons: [share-network]
color: '#8a6bb5'
---
### What it does

Acts as the communication layer connecting the different services.

### How it works

**Mosquitto** runs as the MQTT broker. Services publish messages to topics, while any interested service can independently subscribe to those topics. This keeps the architecture loosely coupled.

### Output / Destination

Messages can simultaneously reach the database writer, environment controller, actuators and other services.
