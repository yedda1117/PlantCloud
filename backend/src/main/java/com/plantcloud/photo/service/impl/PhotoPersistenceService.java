package com.plantcloud.photo.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.plantcloud.photo.entity.MilestoneEnum;
import com.plantcloud.photo.entity.PlantLog;
import com.plantcloud.photo.mapper.PlantLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class PhotoPersistenceService {

    private final PlantLogMapper plantLogMapper;

    @Transactional(rollbackFor = Exception.class)
    public PlantLog saveUploadResult(Long plantId,
                                     LocalDate date,
                                     String originalUrl,
                                     String processedUrl,
                                     String note,
                                     String milestone) {
        PlantLog plantLog = findPlantLog(plantId, date);
        if (plantLog == null) {
            plantLog = new PlantLog();
            plantLog.setPlantId(plantId);
            plantLog.setLogDate(date);
        }

        plantLog.setOriginPhotoUrl(originalUrl);
        plantLog.setPhotoUrl(processedUrl);
        if (note != null) {
            plantLog.setNote(note);
        }
        if (milestone != null) {
            plantLog.setMilestone(MilestoneEnum.normalize(milestone));
        }

        if (plantLog.getId() == null) {
            plantLogMapper.insert(plantLog);
        } else {
            plantLogMapper.updateById(plantLog);
        }
        return plantLog;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deletePhoto(Long plantId, LocalDate date) {
        PlantLog plantLog = findPlantLog(plantId, date);
        if (plantLog == null) {
            return;
        }
        plantLogMapper.update(null, new LambdaUpdateWrapper<PlantLog>()
                .eq(PlantLog::getId, plantLog.getId())
                .set(PlantLog::getPhotoUrl, null)
                .set(PlantLog::getOriginPhotoUrl, null));
    }

    private PlantLog findPlantLog(Long plantId, LocalDate date) {
        return plantLogMapper.selectOne(new LambdaQueryWrapper<PlantLog>()
                .eq(PlantLog::getPlantId, plantId)
                .eq(PlantLog::getLogDate, date)
                .last("limit 1"));
    }
}
