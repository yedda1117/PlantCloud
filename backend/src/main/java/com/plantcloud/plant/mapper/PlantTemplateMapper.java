package com.plantcloud.plant.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.plantcloud.plant.entity.PlantTemplate;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface PlantTemplateMapper extends BaseMapper<PlantTemplate> {

    @Select("""
            SELECT id,
                   plant_name,
                   species,
                   temp_min,
                   temp_max,
                   humidity_min,
                   humidity_max,
                   light_min,
                   light_max,
                   temp_rise_sensitive,
                   humidity_drop_sensitive,
                   light_rise_sensitive,
                   care_level,
                   summary,
                   source_type,
                   created_at,
                   updated_at
            FROM plant_template
            WHERE plant_name = #{plantName}
            ORDER BY id ASC
            LIMIT 1
            """)
    PlantTemplate selectFirstByPlantName(@Param("plantName") String plantName);
}
