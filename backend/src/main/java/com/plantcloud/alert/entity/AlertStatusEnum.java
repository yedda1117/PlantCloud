package com.plantcloud.alert.entity;

import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.system.exception.BizException;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Arrays;

@Getter
@AllArgsConstructor
public enum AlertStatusEnum {

    UNRESOLVED("UNRESOLVED", true),
    RESOLVED("RESOLVED", true),
    IGNORED("IGNORED", false);

    private final String code;
    private final boolean queryable;

    public static AlertStatusEnum fromCode(String code) {
        return Arrays.stream(values())
                .filter(item -> item.code.equalsIgnoreCase(code))
                .findFirst()
                .orElseThrow(() -> new BizException(ResultCode.BAD_REQUEST.getCode(), "Invalid status"));
    }
}
