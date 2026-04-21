package com.plantcloud.control.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.plantcloud.control.entity.DeviceCommandLog;
import org.apache.ibatis.annotations.Mapper;

/**
 * MyBatis Plus mapper for DeviceCommandLog entity.
 * Provides CRUD operations for device command logs.
 */
@Mapper
public interface DeviceCommandLogMapper extends BaseMapper<DeviceCommandLog> {
    // Inherits standard CRUD operations from BaseMapper
}
