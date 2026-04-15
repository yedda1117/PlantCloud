package com.plantcloud.photo.service.impl;

import com.plantcloud.photo.ai.SmartAiClient;
import com.plantcloud.photo.service.PhotoService;
import com.plantcloud.photo.vo.PhotoLogVO;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Service
@RequiredArgsConstructor
public class PhotoServiceImpl implements PhotoService {

    private final SmartAiClient smartAiClient;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Override
    public PhotoLogVO upload(Long plantId, MultipartFile file, Long userId) {
        LocalDate today = LocalDate.now();

        try {
            validateImage(file);

            String originalExtension = getExtension(file.getOriginalFilename());
            Path photoDir = getPhotoDir(today);
            Files.createDirectories(photoDir);

            String id = UUID.randomUUID().toString().replace("-", "");
            Path originalPath = photoDir.resolve(id + "-original." + originalExtension);
            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, originalPath, StandardCopyOption.REPLACE_EXISTING);
            }

            BufferedImage sourceImage = ImageIO.read(originalPath.toFile());
            if (sourceImage == null) {
                throw new IllegalArgumentException("无法读取上传图片");
            }

            SmartAiClient.SegmentResult segmentResult = smartAiClient.segment(sourceImage);
            String originalUrl = toPublicUrl(originalPath);
            String processedUrl = null;
            BigDecimal confidence = null;
            String aiStatus = "FAILED";
            String aiMessage = segmentResult.getMessage();

            if (segmentResult.isSuccess() && segmentResult.getImage() != null) {
                Path processedPath = photoDir.resolve(id + "-processed.png");
                ImageIO.write(segmentResult.getImage(), "png", processedPath.toFile());
                processedUrl = toPublicUrl(processedPath);
                aiStatus = "DONE";

                if (segmentResult.getConfidence() != null) {
                    confidence = BigDecimal.valueOf(segmentResult.getConfidence())
                            .setScale(2, RoundingMode.HALF_UP);
                }
                aiMessage = "class=" + segmentResult.getClassName();
            }

            return PhotoLogVO.builder()
                    .id(0L)
                    .date(today.toString())
                    .originalImageUrl(originalUrl)
                    .processedImageUrl(processedUrl)
                    .thumbnailUrl(processedUrl != null ? processedUrl : originalUrl)
                    .aiStatus(aiStatus)
                    .note(aiMessage)
                    .build();
        } catch (Exception ex) {
            return PhotoLogVO.builder()
                    .id(0L)
                    .date(today.toString())
                    .aiStatus("FAILED")
                    .note(ex.getMessage())
                    .build();
        }
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("没有上传图片");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new IllegalArgumentException("只支持图片文件");
        }
    }

    private Path getPhotoDir(LocalDate date) {
        return Path.of(uploadDir, "photos", date.format(DateTimeFormatter.BASIC_ISO_DATE))
                .toAbsolutePath()
                .normalize();
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "png";
        }
        String extension = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        switch (extension) {
            case "jpg":
            case "jpeg":
            case "png":
            case "webp":
            case "bmp":
                return extension;
            default:
                return "png";
        }
    }

    private String toPublicUrl(Path path) throws IOException {
        Path uploadRoot = Path.of(uploadDir).toAbsolutePath().normalize();
        String relativePath = uploadRoot.relativize(path.toAbsolutePath().normalize())
                .toString()
                .replace('\\', '/');

        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/uploads/")
                .path(relativePath)
                .toUriString();
    }

    @Override
    public List<PhotoLogVO> list(Long plantId) {
        return Collections.emptyList();
    }

    @Override
    public PhotoLogVO getByDate(Long plantId, LocalDate date) {
        return PhotoLogVO.builder()
                .id(0L)
                .date(date.toString())
                .build();
    }
}
