#ifndef __E53_IS2_H__
#define __E53_IS2_H__

typedef void (*E53_IS1_CallbackFunc) (char *arg);

typedef enum
{
    OFF = 0,
    ON
} E53_IS1_Status_ENUM;

void E53_IS1_Init(void);
void E53_IS1_Read_Data(E53_IS1_CallbackFunc func);
int E53_IS1_Read_Status(void);
void Beep_StatusSet(E53_IS1_Status_ENUM status);

#endif
