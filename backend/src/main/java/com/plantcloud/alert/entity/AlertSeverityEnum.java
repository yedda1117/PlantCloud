package com.plantcloud.alert.entity;

import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.system.exception.BizException;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Arrays;

@Getter
@AllArgsConstructor
public enum AlertSeverityEnum {

    LOW("LOW"),
    MEDIUM("MEDIUM"),
    HIGH("HIGH"),
    CRITICAL("CRITICAL");

    private final String code;

    public static AlertSeverityEnum fromCode(String code) {
        return Arrays.stream(values())
                .filter(item -> item.code.equalsIgnoreCase(code))
                .findFirst()
                .orElseThrow(() -> new BizException(ResultCode.BAD_REQUEST.getCode(), "Invalid severity"));
    }
}
