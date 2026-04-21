package com.plantcloud.strategy.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class StrategyLogQueryDTO {

    @Min(value = 1, message = "current 必须大于等于 1")
    private Long current = 1L;

    @Min(value = 1, message = "pageSize 必须大于等于 1")
    @Max(value = 100, message = "pageSize 不能大于 100")
    private Long pageSize = 10L;
    public void setPageNum(Long pageNum) {
        this.current = pageNum;
    }
}
