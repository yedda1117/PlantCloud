package com.plantcloud.plant.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.plantcloud.plant.entity.Plant;
import com.plantcloud.plant.vo.PlantSimpleVO;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface PlantMapper extends BaseMapper<Plant> {

    @Select("""
            SELECT id AS plantId, plant_name AS plantName
            FROM plants
            WHERE status = 'ACTIVE' AND owner_id = #{ownerId}
            """)
    List<PlantSimpleVO> selectSimplePlants(@Param("ownerId") Long ownerId);
}
