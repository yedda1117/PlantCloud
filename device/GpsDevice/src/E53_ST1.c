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

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "E53_ST1.h"
#include "wifiiot_errno.h"
#include "wifiiot_gpio.h"
#include "wifiiot_gpio_ex.h"
#include "wifiiot_pwm.h"
#include "wifiiot_uart.h"

/* GPS 数据全局实例 */
E53_ST1_Data_TypeDef E53_ST1_Data = {0.0f, 0.0f};

/* NMEA GPRMC 缓冲区 */
#define NMEA_BUF_SIZE 128
static char g_nmea_buf[NMEA_BUF_SIZE];

/***************************************************************
 * 函数名称: ParseGPRMC
 * 说    明: 解析 $GPRMC 语句，提取经纬度
 * 参    数: sentence - NMEA 语句字符串
 * 返 回 值: 无
 ***************************************************************/
static void ParseGPRMC(const char *sentence)
{
    /* $GPRMC,HHMMSS,A,LLLL.LL,a,YYYYY.YY,a,x.x,x.x,DDMMYY,x.x,a*hh */
    char buf[NMEA_BUF_SIZE];
    char *token;
    int field = 0;
    float raw_lat = 0.0f, raw_lon = 0.0f;
    char lat_dir = 'N', lon_dir = 'E';

    strncpy(buf, sentence, NMEA_BUF_SIZE - 1);
    buf[NMEA_BUF_SIZE - 1] = '\0';

    token = strtok(buf, ",");
    while (token != NULL) {
        switch (field) {
            case 2: /* 状态：A=有效，V=无效 */
                if (token[0] != 'A') {
                    return; /* 数据无效，不更新 */
                }
                break;
            case 3: /* 纬度 ddmm.mmmm */
                raw_lat = (float)atof(token);
                break;
            case 4: /* N/S */
                lat_dir = token[0];
                break;
            case 5: /* 经度 dddmm.mmmm */
                raw_lon = (float)atof(token);
                break;
            case 6: /* E/W */
                lon_dir = token[0];
                break;
            default:
                break;
        }
        field++;
        token = strtok(NULL, ",");
    }

    /* 转换为十进制度 */
    int lat_deg = (int)(raw_lat / 100);
    float lat_min = raw_lat - lat_deg * 100;
    E53_ST1_Data.Latitude = lat_deg + lat_min / 60.0f;
    if (lat_dir == 'S') {
        E53_ST1_Data.Latitude = -E53_ST1_Data.Latitude;
    }

    int lon_deg = (int)(raw_lon / 100);
    float lon_min = raw_lon - lon_deg * 100;
    E53_ST1_Data.Longitude = lon_deg + lon_min / 60.0f;
    if (lon_dir == 'W') {
        E53_ST1_Data.Longitude = -E53_ST1_Data.Longitude;
    }
}

/***************************************************************
 * 函数名称: Init_E53_ST1
 * 说    明: 初始化 E53_ST1 扩展板（GPIO + UART）
 * 参    数: 无
 * 返 回 值: 无
 ***************************************************************/
void Init_E53_ST1(void)
{
    GpioInit();

    /* 蜂鸣器引脚：GPIO_8 复用为 PWM1 */
    IoSetFunc(WIFI_IOT_IO_NAME_GPIO_8, WIFI_IOT_IO_FUNC_GPIO_8_PWM1_OUT);
    GpioSetDir(WIFI_IOT_IO_NAME_GPIO_8, WIFI_IOT_GPIO_DIR_OUT);
    PwmInit(WIFI_IOT_PWM_PORT_PWM1);

    /* LED 引脚：GPIO_2 输出 */
    IoSetFunc(WIFI_IOT_IO_NAME_GPIO_2, WIFI_IOT_IO_FUNC_GPIO_2_GPIO);
    GpioSetDir(WIFI_IOT_IO_NAME_GPIO_2, WIFI_IOT_GPIO_DIR_OUT);
    GpioSetOutputVal(WIFI_IOT_IO_NAME_GPIO_2, 1); /* 默认熄灭（高电平） */

    /* UART1 用于接收 GPS 模块数据（9600 baud） */
    WifiIotUartAttribute uart_attr = {
        .baudRate = 9600,
        .dataBits = WIFI_IOT_UART_DATA_BIT_8,
        .stopBits = WIFI_IOT_UART_STOP_BIT_1,
        .parity   = WIFI_IOT_UART_PARITY_NONE,
    };
    UartInit(WIFI_IOT_UART_IDX_1, &uart_attr, NULL);

    printf("E53_ST1 initialized.\r\n");
}

/***************************************************************
 * 函数名称: E53_ST1_Read_Data
 * 说    明: 从 UART 读取 GPS NMEA 数据并解析经纬度
 * 参    数: 无
 * 返 回 值: 无
 ***************************************************************/
void E53_ST1_Read_Data(void)
{
    unsigned char ch;
    int idx = 0;

    memset(g_nmea_buf, 0, sizeof(g_nmea_buf));

    /* 等待 '$' 起始符 */
    while (1) {
        if (UartRead(WIFI_IOT_UART_IDX_1, &ch, 1) == 1 && ch == '$') {
            g_nmea_buf[idx++] = (char)ch;
            break;
        }
    }

    /* 读取直到换行或缓冲区满 */
    while (idx < NMEA_BUF_SIZE - 1) {
        if (UartRead(WIFI_IOT_UART_IDX_1, &ch, 1) == 1) {
            if (ch == '\n') {
                break;
            }
            g_nmea_buf[idx++] = (char)ch;
        }
    }
    g_nmea_buf[idx] = '\0';

    /* 只处理 $GPRMC 语句 */
    if (strncmp(g_nmea_buf, "$GPRMC", 6) == 0) {
        ParseGPRMC(g_nmea_buf);
    }
}

/***************************************************************
 * 函数名称: E53_ST1_Beep_StatusSet
 * 说    明: 控制蜂鸣器开关
 * 参    数: status - ON 开启，OFF 关闭
 * 返 回 值: 无
 ***************************************************************/
void E53_ST1_Beep_StatusSet(E53_ST1_Status_ENUM status)
{
    if (status == ON) {
        PwmStart(WIFI_IOT_PWM_PORT_PWM1, 20000, 40000);
    } else {
        PwmStop(WIFI_IOT_PWM_PORT_PWM1);
    }
}
