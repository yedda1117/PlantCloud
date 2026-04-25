package com.plantcloud.photo.service.impl;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;

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

    public Path getUploadRoot() {
        return Path.of(uploadDir).toAbsolutePath().normalize();
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
