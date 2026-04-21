# MQTT Telemetry Data Reception

## Overview

This module implements the reception and storage of environmental monitoring data from IoT devices through MQTT protocol. The system subscribes to telemetry topics, processes incoming sensor data, and stores temperature readings in the database.

## MQTT Topic

### Telemetry Topic Format

```
device/{deviceId}/ia1/telemetry
```

Example: `device/123/ia1/telemetry`

### Telemetry Payload Format

```json
{
  "temperature": 24.5,
  "humidity": 65,
  "light_intensity": 850,
  "fan_status": "OFF",
  "light_status": "ON",
  "timestamp": 1713123456
}
```

### Payload Fields

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| temperature | decimal | Temperature in Celsius | Yes |
| humidity | integer | Humidity percentage (0-100) | Yes |
| light_intensity | integer | Light intensity value | Yes |
| fan_status | string | Fan status: "ON" or "OFF" | Yes |
| light_status | string | Light status: "ON" or "OFF" | Yes |
| timestamp | long | Unix timestamp (seconds) | Yes |

## Data Flow

```
IoT Device → MQTT Broker → DeviceAlertMqttCallback → MqttMessageHandler 
→ Ia1TelemetryMqttListener → TemperatureDataMapper → MySQL Database
```

## Database Storage

### Data Tables

Telemetry data is stored in three separate tables:

#### 1. Temperature Data Table

Data is stored in the `temperature_data` table:

| Database Field | Source | Description |
|----------------|--------|-------------|
| id | Auto-increment | Primary key |
| plant_id | Device.plantId | Associated plant ID |
| device_id | Topic extraction | Device ID from topic |
| temperature | Payload.temperature | Temperature value (°C) |
| raw_payload | Full JSON payload | Complete telemetry data |
| collected_at | Payload.timestamp | Data collection timestamp |
| created_at | Current time | Record creation timestamp |

#### 2. Humidity Data Table

Data is stored in the `humidity_data` table:

| Database Field | Source | Description |
|----------------|--------|-------------|
| id | Auto-increment | Primary key |
| plant_id | Device.plantId | Associated plant ID |
| device_id | Topic extraction | Device ID from topic |
| humidity | Payload.humidity | Humidity percentage (%) |
| raw_payload | Full JSON payload | Complete telemetry data |
| collected_at | Payload.timestamp | Data collection timestamp |
| created_at | Current time | Record creation timestamp |

#### 3. Light Data Table

Data is stored in the `light_data` table:

| Database Field | Source | Description |
|----------------|--------|-------------|
| id | Auto-increment | Primary key |
| plant_id | Device.plantId | Associated plant ID |
| device_id | Topic extraction | Device ID from topic |
| light_lux | Payload.light_intensity | Light intensity (lux) |
| raw_payload | Full JSON payload | Complete telemetry data |
| collected_at | Payload.timestamp | Data collection timestamp |
| created_at | Current time | Record creation timestamp |

### Data Redundancy

The complete telemetry payload (including all sensor readings and device status) is preserved in the `raw_payload` JSON field of each table for:
- Data integrity and audit purposes
- Future analysis and data mining
- Debugging and troubleshooting

## Features

### 1. Automatic Device Status Update

When telemetry data is received:
- Device `onlineStatus` is automatically updated to "ONLINE"
- Device `lastSeenAt` timestamp is updated to current time

### 2. Data Validation

- Device existence is validated before storing data
- Invalid JSON payloads are rejected with error logging
- Missing device records are logged as warnings

### 3. Timestamp Conversion

Unix timestamps from devices are automatically converted to `LocalDateTime` for database storage.

### 4. Error Handling

- JSON parsing errors are caught and logged
- Database insertion failures are logged
- Invalid topic formats are rejected

## Testing

### Using MQTT Client (mosquitto_pub)

```bash
# Publish telemetry data
mosquitto_pub -h localhost -p 1883 \
  -t "device/123/ia1/telemetry" \
  -m '{
    "temperature": 24.5,
    "humidity": 65,
    "light_intensity": 850,
    "fan_status": "OFF",
    "light_status": "ON",
    "timestamp": 1713123456
  }'
```

### Using MQTT.fx or MQTTX

1. Connect to MQTT broker
2. Publish to topic: `device/{deviceId}/ia1/telemetry`
3. Use the JSON payload format above
4. Check database for new records in `temperature_data` table

### Verify Data Storage

```sql
-- Check latest temperature data
SELECT * FROM temperature_data 
ORDER BY collected_at DESC 
LIMIT 10;

-- Check latest humidity data
SELECT * FROM humidity_data 
ORDER BY collected_at DESC 
LIMIT 10;

-- Check latest light data
SELECT * FROM light_data 
ORDER BY collected_at DESC 
LIMIT 10;

-- Check all sensor data for specific device
SELECT 
    t.collected_at,
    t.temperature,
    h.humidity,
    l.light_lux
FROM temperature_data t
LEFT JOIN humidity_data h ON t.device_id = h.device_id AND t.collected_at = h.collected_at
LEFT JOIN light_data l ON t.device_id = l.device_id AND t.collected_at = l.collected_at
WHERE t.device_id = 123 
ORDER BY t.collected_at DESC
LIMIT 10;

-- View raw payload from any table
SELECT id, device_id, temperature, 
       JSON_EXTRACT(raw_payload, '$.humidity') as humidity,
       JSON_EXTRACT(raw_payload, '$.light_intensity') as light_intensity,
       collected_at
FROM temperature_data 
ORDER BY collected_at DESC 
LIMIT 10;
```

## Implementation Details

### Key Classes

1. **TelemetryPayload**: DTO for telemetry data
2. **TemperatureData**: Entity mapping to `temperature_data` table
3. **HumidityData**: Entity mapping to `humidity_data` table
4. **LightData**: Entity mapping to `light_data` table
5. **TemperatureDataMapper**: MyBatis Plus mapper for temperature data
6. **HumidityDataMapper**: MyBatis Plus mapper for humidity data
7. **LightDataMapper**: MyBatis Plus mapper for light data
8. **Ia1TelemetryMqttListener**: MQTT message handler for telemetry data
9. **MqttMessageHandler**: Routes MQTT messages to appropriate listeners

### MQTT Subscription

The system automatically subscribes to `device/+/+/+` topic pattern on startup, which includes:
- `device/{id}/ia1/telemetry` (telemetry data)
- `device/{id}/ia1/control` (control commands)
- Other device topics

## Configuration

MQTT configuration is managed through `application.yml`:

```yaml
app:
  mqtt:
    broker-url: tcp://localhost:1883
    client-id: plantcloud-backend
    subscribe-topic: device/+/+/+
    qos: 1
```

## Logging

All telemetry processing is logged with the following information:

```
INFO  - Received telemetry data. deviceId=123, temperature=24.5, humidity=65, lightIntensity=850
INFO  - Temperature data saved. plantId=1, deviceId=123, temperature=24.5
INFO  - Humidity data saved. plantId=1, deviceId=123, humidity=65
INFO  - Light data saved. plantId=1, deviceId=123, lightLux=850
INFO  - Device status updated to ONLINE. deviceId=123
```

Warning scenarios are logged as:

```
WARN  - Device not found for telemetry data. deviceId=999
WARN  - Temperature is null, skipping temperature data save. deviceId=123
WARN  - Humidity is null, skipping humidity data save. deviceId=123
WARN  - Light intensity is null, skipping light data save. deviceId=123
```

Error scenarios are logged as:

```
ERROR - Failed to process telemetry message. topic=device/123/ia1/telemetry, payload={...}
```

## Future Enhancements

1. **Data Aggregation**: Implement hourly/daily aggregation for historical analysis
2. **Alerting**: Add threshold-based alerting for abnormal sensor readings
3. **Data Retention**: Implement automatic data cleanup for old records
4. **Real-time Updates**: Add WebSocket support for real-time data streaming to frontend
5. **Statistical Analysis**: Add APIs for trend analysis and predictions

## Compatibility

This implementation:
- ✅ Does NOT modify existing database schema
- ✅ Does NOT break existing MQTT message handling
- ✅ Reuses existing MQTT client connection
- ✅ Follows existing code patterns and conventions
- ✅ Maintains backward compatibility with all existing features
- ✅ Stores data in three separate tables (temperature, humidity, light) as per database design
- ✅ Preserves complete telemetry data in raw_payload for each table
