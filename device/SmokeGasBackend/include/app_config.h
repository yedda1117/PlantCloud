#ifndef APP_CONFIG_H
#define APP_CONFIG_H

/* Wi-Fi */
#define APP_WIFI_SSID               "MIFI-B319"
#define APP_WIFI_PASSWORD           "1234567890"

/* MQTT */
#define APP_MQTT_BROKER_HOST        "192.168.100.126"
#define APP_MQTT_BROKER_PORT        1883
#define APP_MQTT_CLIENT_ID          "bearpi-hm-nano-sf1-001"
#define APP_MQTT_TOPIC              "device/6/sf1/alert"

/* Device */
#define APP_DEVICE_ID               "bearpi-hm-nano-sf1-001"
#define APP_SENSOR_NAME             "smoke_gas"

/* Threshold */
#define APP_PPM_WARNING_THRESHOLD   18.0f
#define APP_PPM_DANGER_THRESHOLD   19.0f

/* Polling */
#define APP_SMOKE_POLL_INTERVAL_MS  1000

#endif /* APP_CONFIG_H */
