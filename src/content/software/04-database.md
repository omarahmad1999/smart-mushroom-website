---
order: 4
slug: database
title: Database Ingestion
tab: Database
icons: [notepad, database]
color: '#2E8565'
---
### What it does

Creates a historical record of everything happening in the Mushroom Hub.

### How it works

A database-writer service subscribes to MQTT messages and writes them into **TimescaleDB**, which is built on PostgreSQL and optimized for time-series data.

### Output / Destination

Stores sensor readings, timestamps, device/location information, controller decisions, actuator events, lighting events and camera metadata.
