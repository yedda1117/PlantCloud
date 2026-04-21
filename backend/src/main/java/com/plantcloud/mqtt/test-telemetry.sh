#!/bin/bash

# MQTT Telemetry Test Script
# This script publishes test telemetry data to the MQTT broker

# Configuration
MQTT_HOST="localhost"
MQTT_PORT="1883"
DEVICE_ID="1"  # Change to your device ID

# Test 1: Normal telemetry data
echo "Test 1: Publishing normal telemetry data..."
mosquitto_pub -h $MQTT_HOST -p $MQTT_PORT \
  -t "device/$DEVICE_ID/ia1/telemetry" \
  -m '{
    "temperature": 24.5,
    "humidity": 65,
    "light_intensity": 850,
    "fan_status": "OFF",
    "light_status": "ON",
    "timestamp": '$(date +%s)'
  }'

sleep 2

# Test 2: High temperature
echo "Test 2: Publishing high temperature data..."
mosquitto_pub -h $MQTT_HOST -p $MQTT_PORT \
  -t "device/$DEVICE_ID/ia1/telemetry" \
  -m '{
    "temperature": 35.8,
    "humidity": 80,
    "light_intensity": 1200,
    "fan_status": "ON",
    "light_status": "ON",
    "timestamp": '$(date +%s)'
  }'

sleep 2

# Test 3: Low temperature
echo "Test 3: Publishing low temperature data..."
mosquitto_pub -h $MQTT_HOST -p $MQTT_PORT \
  -t "device/$DEVICE_ID/ia1/telemetry" \
  -m '{
    "temperature": 15.2,
    "humidity": 45,
    "light_intensity": 300,
    "fan_status": "OFF",
    "light_status": "OFF",
    "timestamp": '$(date +%s)'
  }'

sleep 2

# Test 4: Multiple devices
echo "Test 4: Publishing data from multiple devices..."
for i in 1 2 3; do
  mosquitto_pub -h $MQTT_HOST -p $MQTT_PORT \
    -t "device/$i/ia1/telemetry" \
    -m '{
      "temperature": '$((20 + i))',
      "humidity": '$((60 + i * 5))',
      "light_intensity": '$((800 + i * 100))',
      "fan_status": "OFF",
      "light_status": "ON",
      "timestamp": '$(date +%s)'
    }'
  sleep 1
done

echo "All tests completed!"
echo "Check the database with: SELECT * FROM temperature_data ORDER BY created_at DESC LIMIT 10;"
