package com.plantcloud.photo.service.impl;

import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.photo.ai.SmartAiClient;
import com.plantcloud.photo.entity.PlantLog;
import com.plantcloud.photo.service.PhotoService;
import com.plantcloud.photo.vo.PhotoLogVO;
import com.plantcloud.plant.entity.Plant;
import com.plantcloud.plant.mapper.PlantMapper;
import com.plantcloud.system.exception.BizException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PhotoServiceImpl implements PhotoService {

    private final SmartAiClient smartAiClient;
    private final PlantMapper plantMapper;
    private final PhotoPersistenceService photoPersistenceService;
    private final PhotoPathResolver photoPathResolver;

    @Override
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
            String originalUrl = photoPathResolver.toStoredRelativeUrl(originalPath);
            String processedUrl = null;
            String aiStatus = "FAILED";

            if (segmentResult.isSuccess() && segmentResult.getImage() != null) {
                Path processedPath = photoDir.resolve(id + "-processed.png");
                ImageIO.write(segmentResult.getImage(), "png", processedPath.toFile());
                processedUrl = photoPathResolver.toStoredRelativeUrl(processedPath);
                aiStatus = "DONE";
            }

            var plantLog = photoPersistenceService.saveUploadResult(
                    plantId,
                    date,
                    originalUrl,
                    processedUrl,
                    note,
                    milestone
            );

            return toPhotoLogVO(plantLog, aiStatus);
        } catch (IOException ex) {
            throw new BizException(ResultCode.SYSTEM_ERROR.getCode(), ex.getMessage());
        }
    }

    @Override
    public void deletePhoto(Long plantId, LocalDate date) {
        requirePlant(plantId);
        photoPersistenceService.deletePhoto(plantId, date);
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
        return photoPathResolver.getUploadRoot()
                .resolve("calendar")
                .resolve("plant-" + plantId)
                .resolve(date.toString())
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
                .originPhotoUrl(photoPathResolver.normalizeForResponse(plantLog.getOriginPhotoUrl()))
                .photoUrl(photoPathResolver.normalizeForResponse(plantLog.getPhotoUrl()))
                .thumbnailUrl(photoPathResolver.normalizeForResponse(
                        StringUtils.hasText(plantLog.getPhotoUrl()) ? plantLog.getPhotoUrl() : plantLog.getOriginPhotoUrl()))
                .milestone(plantLog.getMilestone())
                .note(plantLog.getNote())
                .hasPhoto(hasPhoto)
                .aiStatus(aiStatus)
                .build();
    }
}
