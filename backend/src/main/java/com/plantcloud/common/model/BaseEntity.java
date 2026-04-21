package com.plantcloud.common.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;

@Data
public class BaseEntity {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;
}