package com.plantcloud.auth.ai;

import cn.smartjavaai.common.entity.R;
import cn.smartjavaai.common.entity.face.FaceSearchResult;
import cn.smartjavaai.common.enums.DeviceEnum;
import cn.smartjavaai.common.enums.SimilarityType;
import cn.smartjavaai.face.config.FaceDetConfig;
import cn.smartjavaai.face.config.FaceRecConfig;
import cn.smartjavaai.face.entity.FaceRegisterInfo;
import cn.smartjavaai.face.entity.FaceSearchParams;
import cn.smartjavaai.face.enums.FaceDetModelEnum;
import cn.smartjavaai.face.enums.FaceRecModelEnum;
import cn.smartjavaai.face.factory.FaceDetModelFactory;
import cn.smartjavaai.face.factory.FaceRecModelFactory;
import cn.smartjavaai.face.model.facedect.FaceDetModel;
import cn.smartjavaai.face.model.facerec.FaceRecModel;
import cn.smartjavaai.face.vector.config.SQLiteConfig;
import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.system.exception.BizException;
import com.plantcloud.user.entity.User;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Base64;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SmartFaceAiClient {

    private final Object modelLock = new Object();
    private volatile FaceRecModel faceRecModel;

    @Value("${app.smartjavaai.face.enabled:true}")
    private boolean enabled;

    @Value("${app.smartjavaai.face.detect-model:MTCNN}")
    private String detectModelName;

    @Value("${app.smartjavaai.face.detect-model-path:}")
    private String detectModelPath;

    @Value("${app.smartjavaai.face.detect-confidence-threshold:0.5}")
    private double detectConfidenceThreshold;

    @Value("${app.smartjavaai.face.rec-model:FACENET_MODEL}")
    private String recModelName;

    @Value("${app.smartjavaai.face.rec-model-path:}")
    private String recModelPath;

    @Value("${app.smartjavaai.face.similarity-threshold:0.7}")
    private float similarityThreshold;

    @Value("${app.smartjavaai.face.sqlite-db-path:data/face.db}")
    private String sqliteDbPath;

    @Value("${app.smartjavaai.face.similarity-type:IP}")
    private String similarityTypeName;

    public void register(User user, String faceImageDataUrl) {
        FaceRegisterInfo info = new FaceRegisterInfo(faceId(user.getId()), metadata(user));
        getFaceRecModel().upsertFace(info, decodeDataUrl(faceImageDataUrl));
    }

    public FaceMatch search(String faceImageDataUrl) {
        FaceSearchParams params = new FaceSearchParams(1, similarityThreshold, false);
        R<List<FaceSearchResult>> response = getFaceRecModel().searchByTopFace(decodeDataUrl(faceImageDataUrl), params);
        if (response == null || !response.isSuccess()) {
            throw new BizException(ResultCode.UNAUTHORIZED.getCode(), responseMessage(response, "Face recognition failed"));
        }

        List<FaceSearchResult> results = response.getData();
        if (results == null || results.isEmpty()) {
            throw new BizException(ResultCode.UNAUTHORIZED.getCode(), "No matching face found");
        }

        FaceSearchResult best = results.get(0);
        if (best.getSimilarity() < similarityThreshold) {
            throw new BizException(
                    ResultCode.UNAUTHORIZED.getCode(),
                    "Face similarity is below threshold: " + best.getSimilarity()
            );
        }

        Long userId = parseUserId(best.getId());
        if (userId == null) {
            throw new BizException(ResultCode.UNAUTHORIZED.getCode(), "Invalid face library record");
        }

        return new FaceMatch(userId, best.getSimilarity(), best.getMetadata());
    }

    private FaceRecModel getFaceRecModel() {
        if (!enabled) {
            throw new BizException(ResultCode.SYSTEM_ERROR.getCode(), "SmartJavaAI face recognition is disabled");
        }

        FaceRecModel model = faceRecModel;
        if (model != null) {
            return model;
        }

        synchronized (modelLock) {
            if (faceRecModel == null) {
                faceRecModel = buildFaceRecModel();
                faceRecModel.loadFaceFeatures();
            }
            return faceRecModel;
        }
    }

    private FaceRecModel buildFaceRecModel() {
        FaceDetConfig detConfig = new FaceDetConfig();
        detConfig.setModelEnum(FaceDetModelEnum.valueOf(detectModelName));
        detConfig.setDevice(DeviceEnum.CPU);
        detConfig.setConfidenceThreshold(detectConfidenceThreshold);
        if (detectModelPath != null && !detectModelPath.isBlank()) {
            detConfig.setModelPath(detectModelPath);
        }

        FaceDetModel detModel = FaceDetModelFactory.getInstance().getModel(detConfig);

        SQLiteConfig vectorDbConfig = new SQLiteConfig();
        vectorDbConfig.setDbPath(resolveSqliteDbPath());
        vectorDbConfig.setSimilarityType(SimilarityType.valueOf(similarityTypeName));

        FaceRecConfig recConfig = new FaceRecConfig();
        recConfig.setModelEnum(FaceRecModelEnum.valueOf(recModelName));
        recConfig.setDevice(DeviceEnum.CPU);
        recConfig.setCropFace(true);
        recConfig.setAlign(true);
        recConfig.setAutoLoadFace(false);
        recConfig.setDetectModel(detModel);
        recConfig.setVectorDBConfig(vectorDbConfig);
        if (recModelPath != null && !recModelPath.isBlank()) {
            recConfig.setModelPath(recModelPath);
        }

        return FaceRecModelFactory.getInstance().getModel(recConfig);
    }

    private String resolveSqliteDbPath() {
        Path path = Path.of(sqliteDbPath);
        Path resolvedPath = path;
        if (!path.isAbsolute()) {
            resolvedPath = Path.of(System.getProperty("user.dir")).resolve(path).normalize();
        }
        Path parent = resolvedPath.getParent();
        if (parent != null) {
            try {
                Files.createDirectories(parent);
            } catch (IOException ex) {
                throw new BizException(ResultCode.SYSTEM_ERROR.getCode(), "Unable to create face database directory");
            }
        }
        return resolvedPath.toString();
    }

    private byte[] decodeDataUrl(String dataUrl) {
        if (dataUrl == null || dataUrl.isBlank()) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "Face image is required");
        }
        int commaIndex = dataUrl.indexOf(',');
        if (commaIndex < 0 || !dataUrl.substring(0, commaIndex).contains(";base64")) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "Invalid face image format");
        }
        try {
            return Base64.getDecoder().decode(dataUrl.substring(commaIndex + 1).getBytes(StandardCharsets.US_ASCII));
        } catch (IllegalArgumentException ex) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "Invalid face image data");
        }
    }

    private String responseMessage(R<?> response, String fallback) {
        if (response == null || response.getMessage() == null || response.getMessage().isBlank()) {
            return fallback;
        }
        return response.getMessage();
    }

    private String faceId(Long userId) {
        return "user-" + userId;
    }

    private Long parseUserId(String faceId) {
        if (faceId == null || !faceId.startsWith("user-")) {
            return null;
        }
        try {
            return Long.valueOf(faceId.substring("user-".length()));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String metadata(User user) {
        return "{\"userId\":" + user.getId()
                + ",\"username\":\"" + escapeJson(user.getUsername()) + "\""
                + ",\"role\":\"" + escapeJson(user.getRole()) + "\"}";
    }

    private String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    public record FaceMatch(Long userId, float similarity, String metadata) {
    }
}
