#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <math.h>
#include "cmsis_os2.h"
#include "E53_IS1.h"
#include "wifiiot_errno.h"
#include "wifiiot_gpio.h"
#include "wifiiot_gpio_ex.h"
#include "wifiiot_pwm.h"

static void E53_IS1_IO_Init(void)
{
    GpioInit();
    IoSetFunc(WIFI_IOT_IO_NAME_GPIO_8, WIFI_IOT_IO_FUNC_GPIO_8_PWM1_OUT);
    GpioSetDir(WIFI_IOT_GPIO_IDX_8, WIFI_IOT_GPIO_DIR_OUT);
    PwmInit(WIFI_IOT_PWM_PORT_PWM1);

    IoSetFunc(WIFI_IOT_IO_NAME_GPIO_7, WIFI_IOT_IO_FUNC_GPIO_7_GPIO);
    GpioSetDir(WIFI_IOT_GPIO_IDX_7, WIFI_IOT_GPIO_DIR_IN);
    IoSetPull(WIFI_IOT_IO_NAME_GPIO_7, WIFI_IOT_IO_PULL_UP);
}

void E53_IS1_Init(void)
{
    E53_IS1_IO_Init();
}

void E53_IS1_Read_Data(E53_IS1_CallbackFunc func)
{
    GpioRegisterIsrFunc(WIFI_IOT_GPIO_IDX_7, WIFI_IOT_INT_TYPE_EDGE,
        WIFI_IOT_GPIO_EDGE_RISE_LEVEL_HIGH, func, NULL);
}

int E53_IS1_Read_Status(void)
{
    WifiIotGpioValue value = WIFI_IOT_GPIO_VALUE0;

    if (GpioGetInputVal(WIFI_IOT_GPIO_IDX_7, &value) != WIFI_IOT_SUCCESS) {
        return 0;
    }

    return (value == WIFI_IOT_GPIO_VALUE1) ? 1 : 0;
}

void Beep_StatusSet(E53_IS1_Status_ENUM status)
{
    if (status == ON) {
        PwmStart(WIFI_IOT_PWM_PORT_PWM1, 20000, 40000);
    }
    if (status == OFF) {
        PwmStop(WIFI_IOT_PWM_PORT_PWM1);
    }
}
