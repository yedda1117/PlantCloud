package com.plantcloud.plant.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.plantcloud.plant.entity.Plant;
import com.plantcloud.plant.vo.PlantRiskProfileVO;
import com.plantcloud.plant.vo.PlantSimpleVO;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.math.BigDecimal;
import java.util.List;

public interface PlantMapper extends BaseMapper<Plant> {

    @Select("""
            SELECT id AS plantId,
                   plant_name AS plantName,
                   status
            FROM plants
            WHERE status = 'ACTIVE' AND owner_id = #{ownerId}
            ORDER BY id ASC
            """)
    List<PlantSimpleVO> selectSimplePlants(@Param("ownerId") Long ownerId);

    @Select("""
            SELECT p.id AS plantId,
                   p.plant_name AS plantName,
                   t.temp_min AS tempMin,
                   t.temp_max AS tempMax,
                   t.humidity_min AS humidityMin,
                   t.humidity_max AS humidityMax,
                   t.light_min AS lightMin,
                   t.light_max AS lightMax,
                   t.temp_rise_sensitive AS tempRiseSensitive,
                   t.humidity_drop_sensitive AS humidityDropSensitive,
                   t.light_rise_sensitive AS lightRiseSensitive
            FROM plants p
            INNER JOIN plant_template t ON p.template_id = t.id
            WHERE p.id = #{plantId}
              AND p.status = 'ACTIVE'
            """)
    PlantRiskProfileVO selectPlantRiskProfile(@Param("plantId") Long plantId);

    @Select("""
            SELECT temperature
            FROM temperature_data
            WHERE plant_id = #{plantId}
              AND collected_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            ORDER BY collected_at DESC
            LIMIT 1
            """)
    BigDecimal selectLatestTemperature(@Param("plantId") Long plantId);

    @Select("""
            SELECT temperature
            FROM temperature_data
            WHERE plant_id = #{plantId}
              AND collected_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            ORDER BY collected_at ASC
            LIMIT 1
            """)
    BigDecimal selectEarliestTemperature(@Param("plantId") Long plantId);

    @Select("""
            SELECT humidity
            FROM humidity_data
            WHERE plant_id = #{plantId}
              AND collected_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            ORDER BY collected_at DESC
            LIMIT 1
            """)
    BigDecimal selectLatestHumidity(@Param("plantId") Long plantId);

    @Select("""
            SELECT humidity
            FROM humidity_data
            WHERE plant_id = #{plantId}
              AND collected_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            ORDER BY collected_at ASC
            LIMIT 1
            """)
    BigDecimal selectEarliestHumidity(@Param("plantId") Long plantId);

    @Select("""
            SELECT light_lux
            FROM light_data
            WHERE plant_id = #{plantId}
              AND collected_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            ORDER BY collected_at DESC
            LIMIT 1
            """)
    BigDecimal selectLatestLight(@Param("plantId") Long plantId);

    @Select("""
            SELECT light_lux
            FROM light_data
            WHERE plant_id = #{plantId}
              AND collected_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            ORDER BY collected_at ASC
            LIMIT 1
            """)
    BigDecimal selectEarliestLight(@Param("plantId") Long plantId);
}
