package com.plantcloud.photo.ai;

import ai.djl.modality.cv.Image;
import cn.smartjavaai.common.cv.SmartImageFactory;
import cn.smartjavaai.common.entity.DetectionInfo;
import cn.smartjavaai.common.entity.DetectionResponse;
import cn.smartjavaai.common.entity.InstanceSegInfo;
import cn.smartjavaai.common.entity.R;
import cn.smartjavaai.common.enums.DeviceEnum;
import cn.smartjavaai.instanceseg.config.InstanceSegModelConfig;
import cn.smartjavaai.instanceseg.enums.InstanceSegModelEnum;
import cn.smartjavaai.instanceseg.model.InstanceSegModel;
import cn.smartjavaai.instanceseg.model.InstanceSegModelFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.util.Comparator;
import java.util.List;

@Component
public class SmartAiClient {

    private final Object modelLock = new Object();
    private volatile InstanceSegModel instanceSegModel;

    @Value("${app.smartjavaai.enabled:true}")
    private boolean enabled;

    @Value("${app.smartjavaai.instance-seg-model:SEG_YOLOV8N_ONNX}")
    private String instanceSegModelName;

    @Value("${app.smartjavaai.model-path:}")
    private String modelPath;

    @Value("${app.smartjavaai.threshold:0.35}")
    private float threshold;

    @Value("${app.smartjavaai.background-color:#EEF8E8}")
    private String backgroundColor;

    public SegmentResult segment(BufferedImage sourceImage) {
        if (!enabled) {
            return SegmentResult.skipped("SmartJavaAI disabled");
        }

        try {
            InstanceSegModel model = getInstanceSegModel();
            Image smartImage = SmartImageFactory.getInstance().fromBufferedImage(sourceImage);
            R<DetectionResponse> response = model.detect(smartImage);

            if (response == null) {
                return SegmentResult.failed("No SmartJavaAI response");
            }
            if (!response.isSuccess()) {
                return SegmentResult.failed(nonBlank(response.getMessage(), "SmartJavaAI returned code " + response.getCode()));
            }
            if (response.getData() == null || response.getData().getDetectionInfoList() == null
                    || response.getData().getDetectionInfoList().isEmpty()) {
                return SegmentResult.failed("SmartJavaAI 未检测到可分割主体");
            }

            DetectionInfo detection = chooseMainDetection(response.getData().getDetectionInfoList());
            if (detection == null || detection.getInstanceSegInfo() == null) {
                return SegmentResult.failed("No instance segmentation mask detected");
            }

            BufferedImage processedImage = applySolidBackground(
                    sourceImage,
                    detection.getInstanceSegInfo().getMask(),
                    Color.decode(backgroundColor)
            );

            return SegmentResult.success(
                    processedImage,
                    detection.getScore(),
                    detection.getInstanceSegInfo().getClassName()
            );
        } catch (Throwable ex) {
            return SegmentResult.failed(ex.getClass().getSimpleName() + ": " + ex.getMessage());
        }
    }

    private String nonBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private InstanceSegModel getInstanceSegModel() {
        InstanceSegModel model = instanceSegModel;
        if (model != null) {
            return model;
        }

        synchronized (modelLock) {
            if (instanceSegModel == null) {
                InstanceSegModelConfig config = new InstanceSegModelConfig(
                        InstanceSegModelEnum.valueOf(instanceSegModelName),
                        DeviceEnum.CPU
                );
                config.setThreshold(threshold);
                if (modelPath != null && !modelPath.isBlank()) {
                    config.setModelPath(modelPath);
                }
                instanceSegModel = InstanceSegModelFactory.getInstance().getModel(config);
            }
            return instanceSegModel;
        }
    }

    private DetectionInfo chooseMainDetection(List<DetectionInfo> detections) {
        if (detections == null || detections.isEmpty()) {
            return null;
        }

        return detections.stream()
                .filter(info -> info.getInstanceSegInfo() != null && info.getInstanceSegInfo().getMask() != null)
                .max(Comparator
                        .comparingInt((DetectionInfo info) -> rectangleArea(info.getDetectionRectangle()))
                        .thenComparingDouble(DetectionInfo::getScore))
                .orElse(null);
    }

    private int rectangleArea(cn.smartjavaai.common.entity.DetectionRectangle rectangle) {
        if (rectangle == null) {
            return 0;
        }
        return Math.max(0, rectangle.getWidth()) * Math.max(0, rectangle.getHeight());
    }

    private BufferedImage applySolidBackground(BufferedImage source, float[][] mask, Color background) {
        BufferedImage output = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = output.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        graphics.setColor(background);
        graphics.fillRect(0, 0, output.getWidth(), output.getHeight());
        graphics.dispose();

        int maskHeight = mask.length;
        int maskWidth = maskHeight > 0 ? mask[0].length : 0;
        if (maskHeight == 0 || maskWidth == 0) {
            return output;
        }

        for (int y = 0; y < source.getHeight(); y++) {
            int maskY = Math.min(maskHeight - 1, Math.max(0, y * maskHeight / source.getHeight()));
            for (int x = 0; x < source.getWidth(); x++) {
                int maskX = Math.min(maskWidth - 1, Math.max(0, x * maskWidth / source.getWidth()));
                if (mask[maskY][maskX] >= 0.5f) {
                    output.setRGB(x, y, source.getRGB(x, y));
                }
            }
        }

        return output;
    }

    public static class SegmentResult {
        private final boolean success;
        private final BufferedImage image;
        private final Float confidence;
        private final String className;
        private final String message;

        private SegmentResult(boolean success, BufferedImage image, Float confidence, String className, String message) {
            this.success = success;
            this.image = image;
            this.confidence = confidence;
            this.className = className;
            this.message = message;
        }

        static SegmentResult success(BufferedImage image, Float confidence, String className) {
            return new SegmentResult(true, image, confidence, className, null);
        }

        static SegmentResult failed(String message) {
            return new SegmentResult(false, null, null, null, message);
        }

        static SegmentResult skipped(String message) {
            return new SegmentResult(false, null, null, null, message);
        }

        public boolean isSuccess() {
            return success;
        }

        public BufferedImage getImage() {
            return image;
        }

        public Float getConfidence() {
            return confidence;
        }

        public String getClassName() {
            return className;
        }

        public String getMessage() {
            return message;
        }
    }
}
