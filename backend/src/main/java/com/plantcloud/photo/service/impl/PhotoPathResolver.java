package com.plantcloud.photo.service.impl;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;

@Component
public class PhotoPathResolver {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public String toStoredRelativeUrl(Path path) {
        Path uploadRoot = getUploadRoot();
        String relativePath = uploadRoot.relativize(path.toAbsolutePath().normalize())
                .toString()
                .replace('\\', '/');
        return "/uploads/" + relativePath;
    }

    public String normalizeForResponse(String storedValue) {
        if (!StringUtils.hasText(storedValue)) {
            return storedValue;
        }

        String trimmed = storedValue.trim();
        if (trimmed.startsWith("/")) {
            return trimmed.replace('\\', '/');
        }

        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (lower.startsWith("http://") || lower.startsWith("https://")) {
            try {
                URI uri = URI.create(trimmed);
                String normalizedPath = normalizePathString(uri.getPath());
                return StringUtils.hasText(normalizedPath) ? normalizedPath : trimmed;
            } catch (IllegalArgumentException ex) {
                return trimmed;
            }
        }

        if (lower.startsWith("file:")) {
            try {
                return normalizeLocalPath(Paths.get(URI.create(trimmed)));
            } catch (Exception ex) {
                return fallbackToFilename(trimmed);
            }
        }

        if (looksLikeLocalPath(trimmed)) {
            try {
                return normalizeLocalPath(Path.of(trimmed));
            } catch (Exception ex) {
                return fallbackToFilename(trimmed);
            }
        }

        return normalizePathString(trimmed);
    }

    public String resolveForPlantLog(String storedValue, Long plantId, LocalDate date) {
        String normalized = normalizeForResponse(storedValue);
        if (!StringUtils.hasText(normalized)) {
            return normalized;
        }

        if (resourceExists(normalized)) {
            return normalized;
        }

        if (plantId == null || date == null) {
            return null;
        }

        String fallback = findExistingPhotoForDate(storedValue, plantId, date);
        return StringUtils.hasText(fallback) ? fallback : null;
    }

    public Path getUploadRoot() {
        return Path.of(uploadDir).toAbsolutePath().normalize();
    }

    public Path getPhotoDirectory(Long plantId, LocalDate date) {
        return getUploadRoot()
                .resolve("photos")
                .resolve(String.valueOf(plantId))
                .toAbsolutePath()
                .normalize();
    }

    private String normalizeLocalPath(Path path) {
        String normalized = path.toAbsolutePath().normalize().toString().replace('\\', '/');
        String candidate = normalizePathString(normalized);
        if (StringUtils.hasText(candidate)) {
            return candidate;
        }
        return fallbackToFilename(normalized);
    }

    private String normalizePathString(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }

        String normalized = value.replace('\\', '/');
        String lower = normalized.toLowerCase(Locale.ROOT);

        int uploadsIndex = lower.indexOf("/uploads/");
        if (uploadsIndex >= 0) {
            return normalized.substring(uploadsIndex);
        }

        int staticIndex = lower.indexOf("/static/");
        if (staticIndex >= 0) {
            return "/" + normalized.substring(staticIndex + "/static/".length());
        }

        return normalized.startsWith("/") ? normalized : null;
    }

    private boolean resourceExists(String normalizedPath) {
        if (!StringUtils.hasText(normalizedPath) || !normalizedPath.startsWith("/uploads/")) {
            return false;
        }
        String relative = normalizedPath.substring("/uploads/".length()).replace('/', java.io.File.separatorChar);
        return Files.exists(getUploadRoot().resolve(relative));
    }

    private String findExistingPhotoForDate(String storedValue, Long plantId, LocalDate date) {
        Path photoDirectory = getPhotoDirectory(plantId, date);
        if (!Files.isDirectory(photoDirectory)) {
            return null;
        }

        String preferredSuffix = detectPreferredSuffix(storedValue);
        try (Stream<Path> files = Files.list(photoDirectory)) {
            List<Path> candidates = files
                    .filter(Files::isRegularFile)
                    .filter(path -> preferredSuffix == null || path.getFileName().toString().contains(preferredSuffix))
                    .sorted(Comparator.comparing(Path::getFileName).reversed())
                    .toList();

            if (!candidates.isEmpty()) {
                return toStoredRelativeUrl(candidates.get(0));
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    private String detectPreferredSuffix(String storedValue) {
        if (!StringUtils.hasText(storedValue)) {
            return null;
        }
        String normalized = storedValue.replace('\\', '/').toLowerCase(Locale.ROOT);
        if (normalized.contains("-processed.")) {
            return "-processed.";
        }
        if (normalized.contains("-original.")) {
            return "-original.";
        }
        return null;
    }

    private boolean looksLikeLocalPath(String value) {
        return value.matches("^[a-zA-Z]:[\\\\/].*") || value.startsWith("\\\\");
    }

    private String fallbackToFilename(String value) {
        String normalized = value.replace('\\', '/');
        int index = normalized.lastIndexOf('/');
        if (index >= 0 && index < normalized.length() - 1) {
            return "/" + normalized.substring(index + 1);
        }
        return normalized.startsWith("/") ? normalized : "/" + normalized;
    }
}
