package com.plantcloud.photo.entity;

import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.system.exception.BizException;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Arrays;

@Getter
@AllArgsConstructor
public enum MilestoneEnum {

    SPROUT("SPROUT"),
    FLOWER("FLOWER"),
    FRUIT("FRUIT"),
    REPOT("REPOT");

    private final String code;

    public static String normalize(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        return Arrays.stream(values())
                .filter(item -> item.code.equalsIgnoreCase(code))
                .findFirst()
                .map(MilestoneEnum::getCode)
                .orElseThrow(() -> new BizException(ResultCode.BAD_REQUEST.getCode(), "Invalid milestone"));
    }
}
