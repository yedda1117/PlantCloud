package com.plantcloud.alert.entity;

import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.system.exception.BizException;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Arrays;

@Getter
@AllArgsConstructor
public enum AlertTypeEnum {

    TEMP_HIGH("TEMP_HIGH"),
    TEMP_LOW("TEMP_LOW"),
    HUMIDITY_HIGH("HUMIDITY_HIGH"),
    HUMIDITY_LOW("HUMIDITY_LOW"),
    LIGHT_HIGH("LIGHT_HIGH"),
    LIGHT_LOW("LIGHT_LOW"),
    SMOKE_ABNORMAL("SMOKE_ABNORMAL"),
    AIR_ABNORMAL("AIR_ABNORMAL"),
    TILT_ABNORMAL("TILT_ABNORMAL"),
    DEVICE_OFFLINE("DEVICE_OFFLINE"),
    OTHER("OTHER");

    private final String code;

    public static AlertTypeEnum fromCode(String code) {
        return Arrays.stream(values())
                .filter(item -> item.code.equalsIgnoreCase(code))
                .findFirst()
                .orElseThrow(() -> new BizException(ResultCode.BAD_REQUEST.getCode(), "Invalid alert_type"));
    }
}
