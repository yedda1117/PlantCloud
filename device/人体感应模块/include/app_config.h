#ifndef APP_CONFIG_H
#define APP_CONFIG_H

/* Wi-Fi and MQTT backend settings */
#define APP_WIFI_SSID               "MIFI-B319"
#define APP_WIFI_PASSWORD           "1234567890"

#define APP_MQTT_BROKER_HOST        "150.158.76.53"
#define APP_MQTT_BROKER_PORT        1883
#define APP_MQTT_CLIENT_ID          "bearpi-hm-nano-001"
#define APP_MQTT_TOPIC              "device/5/is1/event"

#define APP_DEVICE_ID               "bearpi-hm-nano-001"
#define APP_SENSOR_NAME             "infrared"

/* Keep the buzzer on after a detection event. */
#define APP_ALARM_ON_MS             1000
#define APP_CLEAR_DELAY_MS          500

#endif /* APP_CONFIG_H */
