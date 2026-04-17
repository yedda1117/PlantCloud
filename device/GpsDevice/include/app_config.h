#ifndef APP_CONFIG_H
#define APP_CONFIG_H

/* Wi-Fi */
#define APP_WIFI_SSID               "MIFI-B319"
#define APP_WIFI_PASSWORD           "1234567890"

/* MQTT */
#define APP_MQTT_BROKER_HOST        "192.168.100.101"
#define APP_MQTT_BROKER_PORT        1883
#define APP_MQTT_CLIENT_ID          "bearpi-hm-nano-st1-001"
#define APP_MQTT_TOPIC              "device/7/st1/alert"

/* Device */
#define APP_DEVICE_ID               "bearpi-hm-nano-st1-001"
#define APP_SENSOR_NAME             "gps"

/* Polling interval (ms) */
#define APP_GPS_POLL_INTERVAL_MS    2000

#endif /* APP_CONFIG_H */
