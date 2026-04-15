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
#include <unistd.h>
#include <math.h>
#include "E53_SF1.h"
#include "wifiiot_errno.h"
#include "wifiiot_gpio.h"
#include "wifiiot_gpio_ex.h"
#include "wifiiot_pwm.h"
#include "wifiiot_adc.h"

#define CAL_PPM 20  //校准环境中PPM值
#define RL 1        //RL阻值

static float R0;    //元件在洁净空气中的阻值

/***************************************************************
* 函数名称: Init_E53_SF1
* 说    明: 初始化E53_SF1扩展板
* 参    数: 无
* 返 回 值: 无
***************************************************************/
void Init_E53_SF1(void)
{
    GpioInit();                                                           //初始化GPIO
    IoSetFunc(WIFI_IOT_IO_NAME_GPIO_8, WIFI_IOT_IO_FUNC_GPIO_8_PWM1_OUT); //设置GPIO_3引脚复用功能为PWM
    GpioSetDir(WIFI_IOT_IO_NAME_GPIO_8, WIFI_IOT_GPIO_DIR_OUT);           //设置GPIO_3引脚为输出模式
    PwmInit(WIFI_IOT_PWM_PORT_PWM1);                                      //初始化PWM5端口
}

/***************************************************************
* 函数名称: GetVoltage
* 说    明: 获取电压值函数
* 参    数: 无
*								
* 返 回 值: 无
***************************************************************/
static float GetVoltage(void)
{
    unsigned int ret;
    unsigned short data;

    ret = AdcRead(WIFI_IOT_ADC_CHANNEL_6, &data, WIFI_IOT_ADC_EQU_MODEL_8, WIFI_IOT_ADC_CUR_BAIS_DEFAULT, 0xff);
    if (ret != WIFI_IOT_SUCCESS)
    {
        printf("ADC Read Fail\n");
    }
    return (float)data * 1.8 * 4 / 4096.0;
}
/***************************************************************
* 函数名称: GetVoltage
* 说    明: 获取PPM函数
* 参    数: 无
*								
* 返 回 值: ppm
***************************************************************/

float Get_MQ2_PPM(void)
{
    float voltage, RS, ppm;

    voltage = GetVoltage();
    RS = (5 - voltage) / voltage * RL;    //计算RS
    ppm = 613.9f * pow(RS / R0, -2.074f); //计算ppm
    return ppm;
}

/***************************************************************
* 函数名称: MQ2_PPM_Calibration
* 说    明: 传感器校准函数
* 参    数: 无
*								
* 返 回 值: 无
***************************************************************/
void MQ2_PPM_Calibration(void)
{
    float voltage = GetVoltage();
    float RS = (5 - voltage) / voltage * RL;
    R0 = RS / pow(CAL_PPM / 613.9f, 1 / -2.074f);
}

/***************************************************************
* 函数名称: Beep_StatusSet
* 说    明: 蜂鸣器报警与否
* 参    数: status,ENUM枚举的数据
*									OFF,蜂鸣器
*									ON,开蜂鸣器
* 返 回 值: 无
***************************************************************/
void Beep_StatusSet(E53_SF1_Status_ENUM status)
{
    if (status == ON)
        PwmStart(WIFI_IOT_PWM_PORT_PWM1, 20000, 40000); //输出不同占空比的PWM波
    if (status == OFF)
        PwmStop(WIFI_IOT_PWM_PORT_PWM1);
}
