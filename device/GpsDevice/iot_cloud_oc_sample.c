#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>

#include "ohos_init.h"
#include "cmsis_os2.h"

#include "wifi_connect.h"
#include "MQTTClient.h"
#include "E53_ST1.h"
#include "app_config.h"

#define TASK_STACK_SIZE         10240
#define TASK_PRIO               24
#define MQTT_SEND_BUF_SIZE      1024
#define MQTT_READ_BUF_SIZE      1024
#define MQTT_PAYLOAD_BUF_SIZE   256

static unsigned char g_send_buf[MQTT_SEND_BUF_SIZE];
static unsigned char g_read_buf[MQTT_READ_BUF_SIZE];
static Network    g_network;
static MQTTClient g_client;
static int        g_mqtt_ready = 0;

/* ------------------------------------------------------------------ */
/*  MQTT 连接管理                                                       */
/* ------------------------------------------------------------------ */
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

    client_id.cstring    = APP_MQTT_CLIENT_ID;
    data.clientID        = client_id;
    data.willFlag        = 0;
    data.MQTTVersion     = 3;
    data.keepAliveInterval = 60;
    data.cleansession    = 1;

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

/* ------------------------------------------------------------------ */
/*  上报 GPS 位置数据                                                   */
/* ------------------------------------------------------------------ */
static int ReportGpsLocation(float longitude, float latitude)
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
        "\"alert_type\":\"gps_location\","
        "\"longitude\":%.5f,"
        "\"latitude\":%.5f,"
        "\"timestamp\":0"
        "}",
        longitude,
        latitude);

    if (rc <= 0 || rc >= (int)sizeof(payload)) {
        printf("MQTT payload too long\r\n");
        return -1;
    }

    memset(&message, 0, sizeof(message));
    message.qos        = 0;
    message.retained   = 0;
    message.payload    = payload;
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

/* ------------------------------------------------------------------ */
/*  主任务                                                              */
/* ------------------------------------------------------------------ */
static void GpsBackendTask(void)
{
    printf("Connecting to WiFi: %s...\r\n", APP_WIFI_SSID);
    WifiConnect(APP_WIFI_SSID, APP_WIFI_PASSWORD);

    Init_E53_ST1();

    printf("Checking MQTT Connection...\r\n");
    if (MQTTEnsureConnected() == 0) {
        printf(">>> Initial MQTT Connection SUCCESS!\r\n");
    } else {
        printf(">>> Initial MQTT Connection FAILED!\r\n");
    }

    while (1) {
        printf("=======================================\r\n");
        printf("**************E53_ST1_MQTT*************\r\n");
        printf("=======================================\r\n");

        /* 读取 GPS 数据 */
        E53_ST1_Read_Data();

        printf("Longitude: %.5f\r\n", E53_ST1_Data.Longitude);
        printf("Latitude : %.5f\r\n", E53_ST1_Data.Latitude);

        /* 收到有效 GPS 信号时上报并触发蜂鸣器 */
        if (E53_ST1_Data.Longitude != 0.0f || E53_ST1_Data.Latitude != 0.0f) {
            (void)ReportGpsLocation(E53_ST1_Data.Longitude, E53_ST1_Data.Latitude);

            printf("GPs Connected!\r\n");
        }else {
            // 如果经纬度为0，在串口打印提示，方便调试
            printf("Waiting for GPS Signal (No Satellite fix yet)...\r\n");
            // 即使没信号，也可以强制调用一次来检查 MQTT 链路是否活着
            MQTTEnsureConnected(); 
        }

        osDelay(APP_GPS_POLL_INTERVAL_MS);
    }
}

static void GpsBackendEntry(void)
{
    osThreadAttr_t attr;

    attr.name       = "GpsBackendTask";
    attr.attr_bits  = 0U;
    attr.cb_mem     = NULL;
    attr.cb_size    = 0U;
    attr.stack_mem  = NULL;
    attr.stack_size = TASK_STACK_SIZE;
    attr.priority   = TASK_PRIO;

    if (osThreadNew((osThreadFunc_t)GpsBackendTask, NULL, &attr) == NULL) {
        printf("failed to create GpsBackendTask\r\n");
    }
}

APP_FEATURE_INIT(GpsBackendEntry);
