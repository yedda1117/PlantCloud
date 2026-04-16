package com.plantcloud.photo.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.photo.ai.SmartAiClient;
import com.plantcloud.photo.entity.MilestoneEnum;
import com.plantcloud.photo.entity.PlantLog;
import com.plantcloud.photo.mapper.PlantLogMapper;
import com.plantcloud.photo.service.PhotoService;
import com.plantcloud.photo.vo.PhotoLogVO;
import com.plantcloud.plant.entity.Plant;
import com.plantcloud.plant.mapper.PlantMapper;
import com.plantcloud.system.exception.BizException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PhotoServiceImpl implements PhotoService {

    private final SmartAiClient smartAiClient;
    private final PlantLogMapper plantLogMapper;
    private final PlantMapper plantMapper;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PhotoLogVO upload(Long plantId,
                             LocalDate date,
                             MultipartFile photo,
                             String note,
                             String milestone) {
        requirePlant(plantId);
        validateImage(photo);

        try {
            String originalExtension = getExtension(photo.getOriginalFilename());
            Path photoDir = getPhotoDir(plantId, date);
            Files.createDirectories(photoDir);

            String id = UUID.randomUUID().toString().replace("-", "");
            Path originalPath = photoDir.resolve(id + "-original." + originalExtension);
            try (InputStream inputStream = photo.getInputStream()) {
                Files.copy(inputStream, originalPath, StandardCopyOption.REPLACE_EXISTING);
            }

            BufferedImage sourceImage = ImageIO.read(originalPath.toFile());
            if (sourceImage == null) {
                throw new BizException(ResultCode.BAD_REQUEST.getCode(), "Invalid image content");
            }

            SmartAiClient.SegmentResult segmentResult = smartAiClient.segment(sourceImage);
            String originalUrl = toPublicUrl(originalPath);
            String processedUrl = null;
            String aiStatus = "FAILED";

            if (segmentResult.isSuccess() && segmentResult.getImage() != null) {
                Path processedPath = photoDir.resolve(id + "-processed.png");
                ImageIO.write(segmentResult.getImage(), "png", processedPath.toFile());
                processedUrl = toPublicUrl(processedPath);
                aiStatus = "DONE";
            }

            PlantLog plantLog = getOrCreatePlantLog(plantId, date);
            plantLog.setOriginPhotoUrl(originalUrl);
            plantLog.setPhotoUrl(processedUrl);
            if (note != null) {
                plantLog.setNote(note);
            }
            if (milestone != null) {
                plantLog.setMilestone(MilestoneEnum.normalize(milestone));
            }
            savePlantLog(plantLog);

            return toPhotoLogVO(plantLog, aiStatus);
        } catch (IOException ex) {
            throw new BizException(ResultCode.SYSTEM_ERROR.getCode(), ex.getMessage());
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deletePhoto(Long plantId, LocalDate date) {
        requirePlant(plantId);
        PlantLog plantLog = findPlantLog(plantId, date);
        if (plantLog == null) {
            return;
        }
        plantLogMapper.update(null, new LambdaUpdateWrapper<PlantLog>()
                .eq(PlantLog::getId, plantLog.getId())
                .set(PlantLog::getPhotoUrl, null)
                .set(PlantLog::getOriginPhotoUrl, null));
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "photo cannot be empty");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "photo must be an image");
        }
    }

    private Path getPhotoDir(Long plantId, LocalDate date) {
        return Path.of(uploadDir, "photos", String.valueOf(plantId), date.format(DateTimeFormatter.BASIC_ISO_DATE))
                .toAbsolutePath()
                .normalize();
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "png";
        }
        String extension = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        return switch (extension) {
            case "jpg", "jpeg", "png", "webp", "bmp" -> extension;
            default -> "png";
        };
    }

    private String toPublicUrl(Path path) {
        Path uploadRoot = Path.of(uploadDir).toAbsolutePath().normalize();
        String relativePath = uploadRoot.relativize(path.toAbsolutePath().normalize())
                .toString()
                .replace('\\', '/');

        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/uploads/")
                .path(relativePath)
                .toUriString();
    }

    private PlantLog getOrCreatePlantLog(Long plantId, LocalDate date) {
        PlantLog plantLog = findPlantLog(plantId, date);
        if (plantLog != null) {
            return plantLog;
        }
        PlantLog created = new PlantLog();
        created.setPlantId(plantId);
        created.setLogDate(date);
        return created;
    }

    private PlantLog findPlantLog(Long plantId, LocalDate date) {
        return plantLogMapper.selectOne(new LambdaQueryWrapper<PlantLog>()
                .eq(PlantLog::getPlantId, plantId)
                .eq(PlantLog::getLogDate, date)
                .last("limit 1"));
    }

    private void savePlantLog(PlantLog plantLog) {
        if (plantLog.getId() == null) {
            plantLogMapper.insert(plantLog);
            return;
        }
        plantLogMapper.updateById(plantLog);
    }

    private Plant requirePlant(Long plantId) {
        Plant plant = plantMapper.selectById(plantId);
        if (plant == null) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "plant_id is invalid");
        }
        return plant;
    }

    private PhotoLogVO toPhotoLogVO(PlantLog plantLog, String aiStatus) {
        boolean hasPhoto = StringUtils.hasText(plantLog.getPhotoUrl()) || StringUtils.hasText(plantLog.getOriginPhotoUrl());
        return PhotoLogVO.builder()
                .id(plantLog.getId())
                .plantId(plantLog.getPlantId())
                .date(plantLog.getLogDate() == null ? null : plantLog.getLogDate().toString())
                .originPhotoUrl(plantLog.getOriginPhotoUrl())
                .photoUrl(plantLog.getPhotoUrl())
                .thumbnailUrl(StringUtils.hasText(plantLog.getPhotoUrl()) ? plantLog.getPhotoUrl() : plantLog.getOriginPhotoUrl())
                .milestone(plantLog.getMilestone())
                .note(plantLog.getNote())
                .hasPhoto(hasPhoto)
                .aiStatus(aiStatus)
                .build();
    }
}
