#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>

#include "ohos_init.h"
#include "cmsis_os2.h"

#include "wifi_connect.h"
#include "MQTTClient.h"
#include "E53_SF1.h"
#include "app_config.h"

#define TASK_STACK_SIZE             10240
#define TASK_PRIO                   24
#define MQTT_SEND_BUF_SIZE          1024
#define MQTT_READ_BUF_SIZE          1024
#define MQTT_PAYLOAD_BUF_SIZE       512

static unsigned char g_send_buf[MQTT_SEND_BUF_SIZE];
static unsigned char g_read_buf[MQTT_READ_BUF_SIZE];
static Network g_network;
static MQTTClient g_client;
static int g_mqtt_ready = 0;
static int g_last_alarm_status = -1;

typedef enum
{
    AIR_NORMAL = 0,
    AIR_WARNING = 1,
    AIR_DANGER = 2
} AirStatus;

static const char *AirStatusToString(AirStatus status)
{
    switch (status) {
        case AIR_NORMAL:
            return "normal";
        case AIR_WARNING:
            return "warning";
        case AIR_DANGER:
            return "danger";
        default:
            return "unknown";
    }
}

static const char *AirStatusToAlertLevel(AirStatus status)
{
    switch (status) {
        case AIR_NORMAL:
            return "NORMAL";
        case AIR_WARNING:
            return "WARNING";
        case AIR_DANGER:
            return "CRITICAL";
        default:
            return "NORMAL";
    }
}

static AirStatus JudgeAirStatus(float ppm)
{
    if (ppm >= APP_PPM_DANGER_THRESHOLD) {
        return AIR_DANGER;
    }
    if (ppm >= APP_PPM_WARNING_THRESHOLD) {
        return AIR_WARNING;
    }
    return AIR_NORMAL;
}

static int MQTTEnsureConnected(void)
{
    int rc;
    MQTTString client_id = MQTTString_initializer;
    MQTTPacket_connectData data = MQTTPacket_connectData_initializer;

    if (g_mqtt_ready) {
        return 0;
    }

    NetworkInit(&g_network);

    printf("MQTT NetworkConnect: %s:%d\r\n", APP_MQTT_BROKER_HOST, APP_MQTT_BROKER_PORT);
    rc = NetworkConnect(&g_network, APP_MQTT_BROKER_HOST, APP_MQTT_BROKER_PORT);
    if (rc != 0) {
        printf("NetworkConnect failed: %d\r\n", rc);
        return -1;
    }

    MQTTClientInit(&g_client, &g_network, 2000,
                   g_send_buf, sizeof(g_send_buf),
                   g_read_buf, sizeof(g_read_buf));

    client_id.cstring = APP_MQTT_CLIENT_ID;
    data.clientID = client_id;
    data.willFlag = 0;
    data.MQTTVersion = 3;
    data.keepAliveInterval = 60;
    data.cleansession = 1;

    rc = MQTTConnect(&g_client, &data);
    if (rc != 0) {
        printf("MQTTConnect failed: %d\r\n", rc);
        NetworkDisconnect(&g_network);
        return -1;
    }

    g_mqtt_ready = 1;
    printf("MQTT connected, topic=%s\r\n", APP_MQTT_TOPIC);
    return 0;
}

static void MQTTResetConnection(void)
{
    if (g_mqtt_ready) {
        MQTTDisconnect(&g_client);
        NetworkDisconnect(&g_network);
        g_mqtt_ready = 0;
    }
}

static int ReportSmokeStatus(float ppm, AirStatus air_status)
{
    int rc;
    MQTTMessage message;
    char payload[MQTT_PAYLOAD_BUF_SIZE];

    rc = MQTTEnsureConnected();
    if (rc != 0) {
        return -1;
    }

    rc = snprintf(payload, sizeof(payload),
        "{"
        "\"alert_type\":\"smoke_gas_emergency\","
        "\"value\":%.3f,"
        "\"level\":\"%s\","
        "\"timestamp\":0"
        "}",
        ppm,
        AirStatusToAlertLevel(air_status));

    if (rc <= 0 || rc >= (int)sizeof(payload)) {
        printf("MQTT payload too long\r\n");
        return -1;
    }

    memset(&message, 0, sizeof(message));
    message.qos = 0;
    message.retained = 0;
    message.payload = payload;
    message.payloadlen = strlen(payload);

    rc = MQTTPublish(&g_client, APP_MQTT_TOPIC, &message);
    if (rc != 0) {
        printf("MQTT publish failed: %d\r\n", rc);
        MQTTResetConnection();
        return -1;
    }

    rc = MQTTYield(&g_client, 100);
    if (rc != 0) {
        printf("MQTT yield failed: %d\r\n", rc);
        MQTTResetConnection();
        return -1;
    }

    printf("MQTT publish success: %s\r\n", payload);
    return 0;
}

static void SmokeBackendTask(void)
{
    float ppm;
    AirStatus air_status;
    int current_alarm_status;

    WifiConnect(APP_WIFI_SSID, APP_WIFI_PASSWORD);

    Init_E53_SF1();

    usleep(1000000);
    MQ2_PPM_Calibration();
    printf("MQ2 calibration done.\r\n");

    while (1) {
        printf("=======================================\r\n");
        printf("**************E53_SF1_MQTT*************\r\n");
        printf("=======================================\r\n");

        ppm = Get_MQ2_PPM();
        air_status = JudgeAirStatus(ppm);
        current_alarm_status = (air_status == AIR_NORMAL) ? 0 : 1;

        printf("ppm: %.3f\r\n", ppm);
        printf("status: %s\r\n", AirStatusToString(air_status));

        if (air_status == AIR_NORMAL) {
            Beep_StatusSet(OFF);
        } else {
            Beep_StatusSet(ON);
        }

        if (air_status != AIR_NORMAL || current_alarm_status != g_last_alarm_status) {
            (void)ReportSmokeStatus(ppm, air_status);
            g_last_alarm_status = current_alarm_status;
        }

        osDelay(APP_SMOKE_POLL_INTERVAL_MS);
    }
}

static void SmokeBackendEntry(void)
{
    osThreadAttr_t attr;

    attr.name = "SmokeBackendTask";
    attr.attr_bits = 0U;
    attr.cb_mem = NULL;
    attr.cb_size = 0U;
    attr.stack_mem = NULL;
    attr.stack_size = TASK_STACK_SIZE;
    attr.priority = TASK_PRIO;

    if (osThreadNew((osThreadFunc_t)SmokeBackendTask, NULL, &attr) == NULL) {
        printf("failed to create SmokeBackendTask\r\n");
    }
}

APP_FEATURE_INIT(SmokeBackendEntry);
