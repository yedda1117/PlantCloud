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

#ifndef __E53_ST1_H__
#define __E53_ST1_H__

/***************************************************************
 * 名       称: E53_ST1_Status_ENUM
 * 说    明：枚举状态结构体
 ***************************************************************/
typedef enum
{
    OFF = 0,
    ON
} E53_ST1_Status_ENUM;

/***************************************************************
 * 名       称: E53_ST1_Data_TypeDef
 * 说    明：GPS 数据结构体，存放经纬度
 ***************************************************************/
typedef struct
{
    float Longitude; /* 经度 */
    float Latitude;  /* 纬度 */
} E53_ST1_Data_TypeDef;

void  Init_E53_ST1(void);
void  E53_ST1_Read_Data(void);
void  E53_ST1_Beep_StatusSet(E53_ST1_Status_ENUM status);

/* 全局数据结构体，供主程序访问 */
extern E53_ST1_Data_TypeDef E53_ST1_Data;

#endif /* __E53_ST1_H__ */
