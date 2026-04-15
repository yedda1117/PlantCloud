/*
 * Infrared detection demo for BearPi-HM_Nano:
 * 1. connect to Wi-Fi
 * 2. monitor PIR infrared sensor
 * 3. keep silent when someone approaches
 * 4. publish status to backend MQTT topic for database persistence
 */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#include "ohos_init.h"
#include "cmsis_os2.h"

#include "wifi_connect.h"
#include "MQTTClient.h"
#include "E53_IS1.h"
#include "app_config.h"

#define TASK_STACK_SIZE             10240
#define TASK_PRIO                   24
#define INFRARED_EVENT_FLAG         0x00000001U
#define MQTT_SEND_BUF_SIZE          1024
#define MQTT_READ_BUF_SIZE          1024
#define MQTT_PAYLOAD_BUF_SIZE       256
#define INFRARED_POLL_INTERVAL_MS   200

static osEventFlagsId_t g_evt_id;
static unsigned char g_send_buf[MQTT_SEND_BUF_SIZE];
static unsigned char g_read_buf[MQTT_READ_BUF_SIZE];
static Network g_network;
static MQTTClient g_client;
static int g_mqtt_ready = 0;
static int g_last_reported_status = -1;

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

    MQTTClientInit(&g_client, &g_network, 2000, g_send_buf, sizeof(g_send_buf), g_read_buf, sizeof(g_read_buf));

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

static int ReportInfraredStatus(int detected)
{
    int rc;
    MQTTMessage message;
    char payload[MQTT_PAYLOAD_BUF_SIZE];

    rc = MQTTEnsureConnected();
    if (rc != 0) {
        return -1;
    }

    rc = snprintf(payload, sizeof(payload),
        "{\"event_type\":\"human_approach\",\"status\":%d}",
        detected ? 1 : 0);
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

static void InfraredAlarmCallback(char *arg)
{
    (void)arg;
    osEventFlagsSet(g_evt_id, INFRARED_EVENT_FLAG);
}

static void InfraredBackendTask(void)
{
    int current_status;

    WifiConnect(APP_WIFI_SSID, APP_WIFI_PASSWORD);

    E53_IS1_Init();
    E53_IS1_Read_Data(InfraredAlarmCallback);

    current_status = E53_IS1_Read_Status();
    g_last_reported_status = current_status;
    (void)ReportInfraredStatus(current_status);

    while (1) {
        (void)osEventFlagsWait(g_evt_id, INFRARED_EVENT_FLAG, osFlagsWaitAny, INFRARED_POLL_INTERVAL_MS);
        current_status = E53_IS1_Read_Status();
        if (current_status != g_last_reported_status) {
            g_last_reported_status = current_status;
            (void)ReportInfraredStatus(current_status);
        }
    }
}

static void InfraredBackendEntry(void)
{
    osThreadAttr_t attr;

    g_evt_id = osEventFlagsNew(NULL);
    if (g_evt_id == NULL) {
        printf("failed to create event flags\r\n");
        return;
    }

    attr.name = "InfraredBackendTask";
    attr.attr_bits = 0U;
    attr.cb_mem = NULL;
    attr.cb_size = 0U;
    attr.stack_mem = NULL;
    attr.stack_size = TASK_STACK_SIZE;
    attr.priority = TASK_PRIO;

    if (osThreadNew((osThreadFunc_t)InfraredBackendTask, NULL, &attr) == NULL) {
        printf("failed to create InfraredBackendTask\r\n");
    }
}

APP_FEATURE_INIT(InfraredBackendEntry);
