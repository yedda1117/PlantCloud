package com.plantcloud.common.result;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class PageResult<T> {

    private Long current;
    private Long pageSize;
    private Long total;
    private List<T> records;
}
