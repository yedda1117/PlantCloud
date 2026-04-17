SET @plant_id = 1;
SET @temp_humidity_device_id = 1;
SET @light_device_id = 2;
SET @air_device_id = 6;

INSERT INTO temperature_data (plant_id, device_id, temperature, raw_payload, collected_at)
WITH RECURSIVE day_series AS (
  SELECT 0 AS seq, DATE('2026-04-01') AS day_date
  UNION ALL
  SELECT seq + 1, DATE_ADD(day_date, INTERVAL 1 DAY)
  FROM day_series
  WHERE day_date < DATE('2026-04-16')
),
slots AS (
  SELECT 8 AS slot_hour, 1.4 AS slot_offset
  UNION ALL SELECT 14, 5.6
  UNION ALL SELECT 20, 2.5
)
SELECT
  @plant_id,
  @temp_humidity_device_id,
  ROUND(20.8 + ds.seq * 0.18 + slots.slot_offset + MOD(ds.seq, 4) * 0.25, 2),
  JSON_OBJECT('source', 'seed-script', 'metric', 'temperature'),
  TIMESTAMP(ds.day_date, MAKETIME(slots.slot_hour, 0, 0))
FROM day_series ds
CROSS JOIN slots
WHERE NOT EXISTS (
  SELECT 1
  FROM temperature_data td
  WHERE td.plant_id = @plant_id
    AND td.collected_at = TIMESTAMP(ds.day_date, MAKETIME(slots.slot_hour, 0, 0))
);

INSERT INTO humidity_data (plant_id, device_id, humidity, raw_payload, collected_at)
WITH RECURSIVE day_series AS (
  SELECT 0 AS seq, DATE('2026-04-01') AS day_date
  UNION ALL
  SELECT seq + 1, DATE_ADD(day_date, INTERVAL 1 DAY)
  FROM day_series
  WHERE day_date < DATE('2026-04-16')
),
slots AS (
  SELECT 8 AS slot_hour, 68.0 AS base_value
  UNION ALL SELECT 14, 55.0
  UNION ALL SELECT 20, 62.0
)
SELECT
  @plant_id,
  @temp_humidity_device_id,
  ROUND(slots.base_value - ds.seq * 0.35 + MOD(ds.seq, 5) * 1.2, 2),
  JSON_OBJECT('source', 'seed-script', 'metric', 'humidity'),
  TIMESTAMP(ds.day_date, MAKETIME(slots.slot_hour, 0, 0))
FROM day_series ds
CROSS JOIN slots
WHERE NOT EXISTS (
  SELECT 1
  FROM humidity_data hd
  WHERE hd.plant_id = @plant_id
    AND hd.collected_at = TIMESTAMP(ds.day_date, MAKETIME(slots.slot_hour, 0, 0))
);

INSERT INTO light_data (plant_id, device_id, light_lux, raw_payload, collected_at)
WITH RECURSIVE day_series AS (
  SELECT 0 AS seq, DATE('2026-04-01') AS day_date
  UNION ALL
  SELECT seq + 1, DATE_ADD(day_date, INTERVAL 1 DAY)
  FROM day_series
  WHERE day_date < DATE('2026-04-16')
),
slots AS (
  SELECT 8 AS slot_hour, 1800 AS base_value
  UNION ALL SELECT 12, 18500
  UNION ALL SELECT 16, 6200
)
SELECT
  @plant_id,
  @light_device_id,
  ROUND(slots.base_value + ds.seq * 140 + MOD(ds.seq, 3) * 220, 2),
  JSON_OBJECT('source', 'seed-script', 'metric', 'light'),
  TIMESTAMP(ds.day_date, MAKETIME(slots.slot_hour, 0, 0))
FROM day_series ds
CROSS JOIN slots
WHERE NOT EXISTS (
  SELECT 1
  FROM light_data ld
  WHERE ld.plant_id = @plant_id
    AND ld.collected_at = TIMESTAMP(ds.day_date, MAKETIME(slots.slot_hour, 0, 0))
);

INSERT INTO temperature_data (plant_id, device_id, temperature, raw_payload, collected_at)
WITH RECURSIVE hour_series AS (
  SELECT TIMESTAMP('2026-04-16 16:00:00') AS ts
  UNION ALL
  SELECT DATE_ADD(ts, INTERVAL 1 HOUR)
  FROM hour_series
  WHERE ts < TIMESTAMP('2026-04-17 15:00:00')
)
SELECT
  @plant_id,
  @temp_humidity_device_id,
  ROUND(
    CASE
      WHEN HOUR(ts) BETWEEN 0 AND 5 THEN 20.5 + HOUR(ts) * 0.25
      WHEN HOUR(ts) BETWEEN 6 AND 10 THEN 22.5 + (HOUR(ts) - 6) * 0.9
      WHEN HOUR(ts) BETWEEN 11 AND 15 THEN 27.0 + (HOUR(ts) - 11) * 0.45
      WHEN HOUR(ts) BETWEEN 16 AND 19 THEN 27.6 - (HOUR(ts) - 16) * 0.5
      ELSE 23.8 - (HOUR(ts) - 20) * 0.4
    END,
    2
  ),
  JSON_OBJECT('source', 'seed-script', 'metric', 'temperature-24h'),
  ts
FROM hour_series
WHERE NOT EXISTS (
  SELECT 1
  FROM temperature_data td
  WHERE td.plant_id = @plant_id
    AND td.collected_at = hour_series.ts
);

INSERT INTO humidity_data (plant_id, device_id, humidity, raw_payload, collected_at)
WITH RECURSIVE hour_series AS (
  SELECT TIMESTAMP('2026-04-16 16:00:00') AS ts
  UNION ALL
  SELECT DATE_ADD(ts, INTERVAL 1 HOUR)
  FROM hour_series
  WHERE ts < TIMESTAMP('2026-04-17 15:00:00')
)
SELECT
  @plant_id,
  @temp_humidity_device_id,
  ROUND(
    CASE
      WHEN HOUR(ts) BETWEEN 0 AND 5 THEN 69.0 - HOUR(ts) * 1.1
      WHEN HOUR(ts) BETWEEN 6 AND 10 THEN 61.5 - (HOUR(ts) - 6) * 1.2
      WHEN HOUR(ts) BETWEEN 11 AND 15 THEN 57.0 - (HOUR(ts) - 11) * 0.35
      WHEN HOUR(ts) BETWEEN 16 AND 19 THEN 58.0 + (HOUR(ts) - 16) * 1.1
      ELSE 63.0 + (HOUR(ts) - 20) * 0.9
    END,
    2
  ),
  JSON_OBJECT('source', 'seed-script', 'metric', 'humidity-24h'),
  ts
FROM hour_series
WHERE NOT EXISTS (
  SELECT 1
  FROM humidity_data hd
  WHERE hd.plant_id = @plant_id
    AND hd.collected_at = hour_series.ts
);

INSERT INTO light_data (plant_id, device_id, light_lux, raw_payload, collected_at)
WITH RECURSIVE hour_series AS (
  SELECT TIMESTAMP('2026-04-16 16:00:00') AS ts
  UNION ALL
  SELECT DATE_ADD(ts, INTERVAL 1 HOUR)
  FROM hour_series
  WHERE ts < TIMESTAMP('2026-04-17 15:00:00')
)
SELECT
  @plant_id,
  @light_device_id,
  ROUND(
    CASE
      WHEN HOUR(ts) BETWEEN 0 AND 5 THEN 120 + HOUR(ts) * 18
      WHEN HOUR(ts) = 6 THEN 550
      WHEN HOUR(ts) = 7 THEN 1600
      WHEN HOUR(ts) = 8 THEN 4200
      WHEN HOUR(ts) = 9 THEN 8800
      WHEN HOUR(ts) = 10 THEN 14200
      WHEN HOUR(ts) = 11 THEN 19600
      WHEN HOUR(ts) = 12 THEN 23800
      WHEN HOUR(ts) = 13 THEN 26500
      WHEN HOUR(ts) = 14 THEN 21400
      WHEN HOUR(ts) = 15 THEN 16800
      WHEN HOUR(ts) = 16 THEN 9200
      WHEN HOUR(ts) = 17 THEN 4300
      WHEN HOUR(ts) = 18 THEN 900
      WHEN HOUR(ts) = 19 THEN 260
      ELSE 140
    END,
    2
  ),
  JSON_OBJECT('source', 'seed-script', 'metric', 'light-24h'),
  ts
FROM hour_series
WHERE NOT EXISTS (
  SELECT 1
  FROM light_data ld
  WHERE ld.plant_id = @plant_id
    AND ld.collected_at = hour_series.ts
);

INSERT INTO alert_logs (
  plant_id,
  device_id,
  alert_type,
  severity,
  title,
  content,
  metric_name,
  metric_value,
  threshold_value,
  status,
  resolved_at,
  extra_data,
  created_at
)
SELECT *
FROM (
  SELECT @plant_id, @air_device_id, 'AIR_ABNORMAL', 'MEDIUM', 'Air quality spike', 'Air quality was temporarily elevated and then recovered.', 'air_ppm', 145.00, 300.00, 'RESOLVED', TIMESTAMP('2026-04-03 10:20:00'), JSON_OBJECT('source', 'seed-script'), TIMESTAMP('2026-04-03 09:50:00')
  UNION ALL SELECT @plant_id, @air_device_id, 'SMOKE_ABNORMAL', 'MEDIUM', 'Smoke or gas fluctuation', 'A mild smoke or gas fluctuation was detected and later recovered.', 'smoke_gas_ppm', 182.00, 300.00, 'RESOLVED', TIMESTAMP('2026-04-06 14:40:00'), JSON_OBJECT('source', 'seed-script'), TIMESTAMP('2026-04-06 14:05:00')
  UNION ALL SELECT @plant_id, @air_device_id, 'AIR_ABNORMAL', 'MEDIUM', 'Air quality fluctuation', 'Air quality rose above baseline for a short time.', 'air_ppm', 210.00, 300.00, 'RESOLVED', TIMESTAMP('2026-04-09 16:00:00'), JSON_OBJECT('source', 'seed-script'), TIMESTAMP('2026-04-09 15:20:00')
  UNION ALL SELECT @plant_id, @air_device_id, 'SMOKE_ABNORMAL', 'HIGH', 'Strong smoke alert', 'A strong smoke or gas anomaly was detected.', 'smoke_gas_ppm', 336.00, 300.00, 'RESOLVED', TIMESTAMP('2026-04-11 13:35:00'), JSON_OBJECT('source', 'seed-script'), TIMESTAMP('2026-04-11 13:10:00')
  UNION ALL SELECT @plant_id, @air_device_id, 'AIR_ABNORMAL', 'MEDIUM', 'Ventilation reminder', 'Air quality increased briefly before returning to normal.', 'air_ppm', 195.00, 300.00, 'RESOLVED', TIMESTAMP('2026-04-13 18:25:00'), JSON_OBJECT('source', 'seed-script'), TIMESTAMP('2026-04-13 17:55:00')
  UNION ALL SELECT @plant_id, @air_device_id, 'SMOKE_ABNORMAL', 'HIGH', 'Smoke alert resolved', 'High smoke or gas concentration was detected and then resolved.', 'smoke_gas_ppm', 358.00, 300.00, 'RESOLVED', TIMESTAMP('2026-04-15 16:10:00'), JSON_OBJECT('source', 'seed-script'), TIMESTAMP('2026-04-15 15:45:00')
  UNION ALL SELECT @plant_id, @air_device_id, 'AIR_ABNORMAL', 'MEDIUM', 'Air quality warning', 'Air quality remains slightly elevated and should be monitored.', 'air_ppm', 168.00, 300.00, 'UNRESOLVED', NULL, JSON_OBJECT('source', 'seed-script'), TIMESTAMP('2026-04-16 11:30:00')
  UNION ALL SELECT @plant_id, @air_device_id, 'SMOKE_ABNORMAL', 'MEDIUM', 'Air quality monitoring', 'Air quality is still fluctuating and needs observation.', 'smoke_gas_ppm', 188.00, 300.00, 'UNRESOLVED', NULL, JSON_OBJECT('source', 'seed-script'), TIMESTAMP('2026-04-17 14:40:00')
) AS seeded(plant_id, device_id, alert_type, severity, title, content, metric_name, metric_value, threshold_value, status, resolved_at, extra_data, created_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM alert_logs al
  WHERE al.plant_id = seeded.plant_id
    AND al.device_id = seeded.device_id
    AND al.alert_type = seeded.alert_type
    AND al.created_at = seeded.created_at
);
