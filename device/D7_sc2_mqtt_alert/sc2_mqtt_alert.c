/*
 * Copyright (c) 2020 Nanjing Xiaoxiongpai Intelligent Technology Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <stdbool.h>
#include <stdio.h>
#include <string.h>

#include "ohos_init.h"
#include "cmsis_os2.h"

#include "E53_SC2.h"
#include "MQTTClient.h"
#include "wifi_connect.h"

#define TASK_STACK_SIZE      (1024 * 10)
#define TASK_PRIO            25
#define MQTT_BROKER_IP       "150.158.76.53"
#define MQTT_BROKER_PORT     1883
#define MQTT_TOPIC           "device/1/sc2/alert"
#define MQTT_CLIENT_ID       "bearpi_sc2_alert"
#define MQTT_KEEPALIVE_S     60
#define MQTT_COMMAND_TIMEOUT 2000
#define TILT_THRESHOLD       100

/*
 * Update these two macros to match the local AP used by the BearPi board.
 * They default to the same values used in the D5_iot_mqtt sample.
 */
#define WIFI_SSID            "MIFI-B319"
#define WIFI_PASSWORD        "1234567890"

static unsigned char g_sendBuf[1024];
static unsigned char g_readBuf[1024];
static Network g_network;
static MQTTClient g_client;
static bool g_mqttConnected = false;

E53_SC2_Data_TypeDef E53_SC2_Data;

static int g_baseAccel[3] = {0};
static bool g_hasBaseline = false;

static unsigned int GetTimestampSeconds(void)
{
    return 1713123456U + (unsigned int)(osKernelGetTickCount() / 1000U);
}

static void DisconnectMqtt(void)
{
    if (g_mqttConnected) {
        MQTTDisconnect(&g_client);
        g_mqttConnected = false;
    }
    NetworkDisconnect(&g_network);
}

static int ConnectMqttBroker(void)
{
    int rc;
    MQTTString clientId = MQTTString_initializer;
    MQTTPacket_connectData data = MQTTPacket_connectData_initializer;

    NetworkInit(&g_network);
    rc = NetworkConnect(&g_network, MQTT_BROKER_IP, MQTT_BROKER_PORT);
    if (rc != 0) {
        printf("NetworkConnect failed, rc=%d\r\n", rc);
        return rc;
    }

    MQTTClientInit(&g_client, &g_network, MQTT_COMMAND_TIMEOUT, g_sendBuf, sizeof(g_sendBuf),
        g_readBuf, sizeof(g_readBuf));

    clientId.cstring = MQTT_CLIENT_ID;
    data.clientID = clientId;
    data.willFlag = 0;
    data.MQTTVersion = 3;
    data.keepAliveInterval = MQTT_KEEPALIVE_S;
    data.cleansession = 1;
    data.username.cstring = NULL;
    data.password.cstring = NULL;

    rc = MQTTConnect(&g_client, &data);
    if (rc != 0) {
        printf("MQTTConnect failed, rc=%d\r\n", rc);
        NetworkDisconnect(&g_network);
        return rc;
    }

    g_mqttConnected = true;
    printf("MQTT connected to %s:%d\r\n", MQTT_BROKER_IP, MQTT_BROKER_PORT);
    return 0;
}

static void EnsureMqttConnected(void)
{
    while (!g_mqttConnected) {
        if (ConnectMqttBroker() == 0) {
            break;
        }
        osDelay(1000);
    }
}

void PublishTiltStatus(bool isTilt)
{
    int rc;
    MQTTMessage message;
    char payload[128];

    EnsureMqttConnected();

    (void)memset(&message, 0, sizeof(message));
    (void)snprintf(payload, sizeof(payload),
        "{\n"
        "  \"alert_type\": \"tilt_detected\",\n"
        "  \"is_tilt\": %s,\n"
        "  \"timestamp\": %u\n"
        "}",
        isTilt ? "true" : "false",
        GetTimestampSeconds());

    message.qos = 0;
    message.retained = 0;
    message.payload = payload;
    message.payloadlen = strlen(payload);

    rc = MQTTPublish(&g_client, MQTT_TOPIC, &message);
    if (rc != 0) {
        printf("MQTT publish failed, rc=%d\r\n", rc);
        DisconnectMqtt();
        return;
    }

    printf("MQTT publish success: %s\r\n", payload);
}

static bool IsTiltDetected(void)
{
    int axis = 0;

    if (!g_hasBaseline) {
        for (axis = 0; axis < 3; axis++) {
            g_baseAccel[axis] = (int)E53_SC2_Data.Accel[axis];
        }
        g_hasBaseline = true;
        return false;
    }

    for (axis = 0; axis < 3; axis++) {
        int current = (int)E53_SC2_Data.Accel[axis];
        if ((current > (g_baseAccel[axis] + TILT_THRESHOLD)) ||
            (current < (g_baseAccel[axis] - TILT_THRESHOLD))) {
            return true;
        }
    }

    return false;
}

static void Sc2MqttAlertTask(void)
{
    bool last_state = false;

    if (WifiConnect(WIFI_SSID, WIFI_PASSWORD) != 0) {
        printf("WiFi connect failed\r\n");
        return;
    }

    E53_SC2_Init();
    EnsureMqttConnected();

    while (1) {
        bool current_state;

        E53_SC2_Read_Data();
        current_state = IsTiltDetected();

        if (current_state != last_state) {
            PublishTiltStatus(current_state);
            last_state = current_state;
        }

        if (current_state) {
            LED_D1_StatusSet(OFF);
            LED_D2_StatusSet(ON);
        } else {
            LED_D1_StatusSet(ON);
            LED_D2_StatusSet(OFF);
        }

        osDelay(1000);
    }
}

static void Sc2MqttAlertEntry(void)
{
    osThreadAttr_t attr;

    attr.name = "Sc2MqttAlertTask";
    attr.attr_bits = 0U;
    attr.cb_mem = NULL;
    attr.cb_size = 0U;
    attr.stack_mem = NULL;
    attr.stack_size = TASK_STACK_SIZE;
    attr.priority = TASK_PRIO;

    if (osThreadNew((osThreadFunc_t)Sc2MqttAlertTask, NULL, &attr) == NULL) {
        printf("Failed to create Sc2MqttAlertTask!\r\n");
    }
}

APP_FEATURE_INIT(Sc2MqttAlertEntry);
