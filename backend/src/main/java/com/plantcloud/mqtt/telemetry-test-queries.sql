-- Telemetry Data Test Queries

-- ========================================
-- TEMPERATURE DATA QUERIES
-- ========================================

-- 1. Check latest temperature data
SELECT 
    id,
    plant_id,
    device_id,
    temperature,
    collected_at,
    created_at
FROM temperature_data 
ORDER BY collected_at DESC 
LIMIT 10;

-- 2. Check data for specific device
SELECT 
    id,
    plant_id,
    device_id,
    temperature,
    collected_at
FROM temperature_data 
WHERE device_id = 1  -- Replace with your device ID
ORDER BY collected_at DESC;

-- 3. View complete telemetry data from raw_payload
SELECT 
    id,
    device_id,
    temperature,
    JSON_EXTRACT(raw_payload, '$.humidity') as humidity,
    JSON_EXTRACT(raw_payload, '$.light_intensity') as light_intensity,
    JSON_EXTRACT(raw_payload, '$.fan_status') as fan_status,
    JSON_EXTRACT(raw_payload, '$.light_status') as light_status,
    JSON_EXTRACT(raw_payload, '$.timestamp') as device_timestamp,
    collected_at,
    created_at
FROM temperature_data 
ORDER BY collected_at DESC 
LIMIT 10;

-- ========================================
-- HUMIDITY DATA QUERIES
-- ========================================

-- 4. Check latest humidity data
SELECT 
    id,
    plant_id,
    device_id,
    humidity,
    collected_at,
    created_at
FROM humidity_data 
ORDER BY collected_at DESC 
LIMIT 10;

-- 5. Humidity data for specific device
SELECT 
    id,
    plant_id,
    device_id,
    humidity,
    collected_at
FROM humidity_data 
WHERE device_id = 1  -- Replace with your device ID
ORDER BY collected_at DESC;

-- 6. Humidity trend for specific device (last 24 hours)
SELECT 
    DATE_FORMAT(collected_at, '%Y-%m-%d %H:%i') as time_bucket,
    AVG(humidity) as avg_humidity,
    MIN(humidity) as min_humidity,
    MAX(humidity) as max_humidity,
    COUNT(*) as reading_count
FROM humidity_data 
WHERE device_id = 1  -- Replace with your device ID
  AND collected_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY DATE_FORMAT(collected_at, '%Y-%m-%d %H:%i')
ORDER BY time_bucket DESC;

-- ========================================
-- LIGHT DATA QUERIES
-- ========================================

-- 7. Check latest light data
SELECT 
    id,
    plant_id,
    device_id,
    light_lux,
    collected_at,
    created_at
FROM light_data 
ORDER BY collected_at DESC 
LIMIT 10;

-- 8. Light data for specific device
SELECT 
    id,
    plant_id,
    device_id,
    light_lux,
    collected_at
FROM light_data 
WHERE device_id = 1  -- Replace with your device ID
ORDER BY collected_at DESC;

-- 9. Light intensity trend for specific device (last 24 hours)
SELECT 
    DATE_FORMAT(collected_at, '%Y-%m-%d %H:%i') as time_bucket,
    AVG(light_lux) as avg_light,
    MIN(light_lux) as min_light,
    MAX(light_lux) as max_light,
    COUNT(*) as reading_count
FROM light_data 
WHERE device_id = 1  -- Replace with your device ID
  AND collected_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY DATE_FORMAT(collected_at, '%Y-%m-%d %H:%i')
ORDER BY time_bucket DESC;

-- ========================================
-- COMBINED QUERIES
-- ========================================

-- 10. All sensor data for specific device (latest reading)
SELECT 
    t.collected_at,
    t.temperature,
    h.humidity,
    l.light_lux
FROM temperature_data t
LEFT JOIN humidity_data h ON t.device_id = h.device_id AND t.collected_at = h.collected_at
LEFT JOIN light_data l ON t.device_id = l.device_id AND t.collected_at = l.collected_at
WHERE t.device_id = 1  -- Replace with your device ID
ORDER BY t.collected_at DESC
LIMIT 10;

-- 11. Count records per device (all sensor types)
SELECT 
    d.id as device_id,
    d.device_name,
    COUNT(DISTINCT t.id) as temp_records,
    COUNT(DISTINCT h.id) as humidity_records,
    COUNT(DISTINCT l.id) as light_records
FROM devices d
LEFT JOIN temperature_data t ON d.id = t.device_id
LEFT JOIN humidity_data h ON d.id = h.device_id
LEFT JOIN light_data l ON d.id = l.device_id
GROUP BY d.id, d.device_name
ORDER BY d.id;

-- 12. Latest reading from all sensors for all devices
SELECT 
    d.id as device_id,
    d.device_name,
    d.online_status,
    (SELECT temperature FROM temperature_data WHERE device_id = d.id ORDER BY collected_at DESC LIMIT 1) as latest_temp,
    (SELECT humidity FROM humidity_data WHERE device_id = d.id ORDER BY collected_at DESC LIMIT 1) as latest_humidity,
    (SELECT light_lux FROM light_data WHERE device_id = d.id ORDER BY collected_at DESC LIMIT 1) as latest_light,
    d.last_seen_at
FROM devices d
WHERE d.id IN (SELECT DISTINCT device_id FROM temperature_data)
ORDER BY d.last_seen_at DESC;

-- ========================================
-- STATISTICS QUERIES
-- ========================================

-- 13. Temperature readings in last hour
SELECT 
    device_id,
    temperature,
    collected_at
FROM temperature_data 
WHERE collected_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY collected_at DESC;

-- 14. Temperature trend for specific device
SELECT 
    DATE_FORMAT(collected_at, '%Y-%m-%d %H:%i') as time_bucket,
    AVG(temperature) as avg_temp,
    MIN(temperature) as min_temp,
    MAX(temperature) as max_temp,
    COUNT(*) as reading_count
FROM temperature_data 
WHERE device_id = 1  -- Replace with your device ID
  AND collected_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY DATE_FORMAT(collected_at, '%Y-%m-%d %H:%i')
ORDER BY time_bucket DESC;

-- 15. Check device online status
SELECT 
    id,
    device_name,
    device_code,
    online_status,
    last_seen_at
FROM devices
WHERE id IN (SELECT DISTINCT device_id FROM temperature_data)
ORDER BY last_seen_at DESC;

-- ========================================
-- DATA VALIDATION QUERIES
-- ========================================

-- 16. Verify raw_payload JSON structure (temperature)
SELECT 
    id,
    device_id,
    raw_payload,
    JSON_VALID(raw_payload) as is_valid_json
FROM temperature_data 
ORDER BY id DESC 
LIMIT 5;

-- 17. Verify raw_payload JSON structure (humidity)
SELECT 
    id,
    device_id,
    raw_payload,
    JSON_VALID(raw_payload) as is_valid_json
FROM humidity_data 
ORDER BY id DESC 
LIMIT 5;

-- 18. Verify raw_payload JSON structure (light)
SELECT 
    id,
    device_id,
    raw_payload,
    JSON_VALID(raw_payload) as is_valid_json
FROM light_data 
ORDER BY id DESC 
LIMIT 5;

-- ========================================
-- CLEANUP QUERIES (USE WITH CAUTION!)
-- ========================================

-- 19. Clean up test data for specific device
-- DELETE FROM temperature_data WHERE device_id = 999;
-- DELETE FROM humidity_data WHERE device_id = 999;
-- DELETE FROM light_data WHERE device_id = 999;

-- ========================================
-- TABLE STRUCTURE QUERIES
-- ========================================

-- 20. Check table structures
DESCRIBE temperature_data;
DESCRIBE humidity_data;
DESCRIBE light_data;
