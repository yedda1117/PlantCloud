package com.plantcloud.control.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.plantcloud.control.dto.DeviceControlRequest;
import com.plantcloud.control.entity.DeviceCommandLog;
import com.plantcloud.control.enums.CommandStatus;
import com.plantcloud.control.enums.ControlTarget;
import com.plantcloud.control.exception.DeviceNotFoundException;
import com.plantcloud.control.exception.InvalidCommandException;
import com.plantcloud.control.exception.MqttPublishException;
import com.plantcloud.control.model.PublishResult;
import com.plantcloud.control.service.DeviceCommandService;
import com.plantcloud.control.service.MqttPublishService;
import com.plantcloud.control.vo.ControlCommandVO;
import com.plantcloud.device.entity.Device;
import com.plantcloud.device.mapper.DeviceMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceCommandServiceImpl implements DeviceCommandService {

    private final DeviceMapper deviceMapper;
    private final MqttPublishService mqttService;
    private final ObjectMapper objectMapper;
    private final DeviceCommandPersistenceService commandPersistenceService;

    @Override
    public ControlCommandVO controlLight(DeviceControlRequest request) {
        return execute(request, ControlTarget.LIGHT);
    }

    @Override
    public ControlCommandVO controlFan(DeviceControlRequest request) {
        return execute(request, ControlTarget.FAN);
    }

    private ControlCommandVO execute(DeviceControlRequest request, ControlTarget target) {
        log.info("Processing device command. plantId={}, deviceId={}, target={}, command={}",
                request.getPlantId(), request.getDeviceId(), target, request.getCommandValue());

        Device device = deviceMapper.selectById(request.getDeviceId());
        if (device == null) {
            throw new DeviceNotFoundException("Device not found: " + request.getDeviceId());
        }

        validateTargetDeviceType(target, device);
        String action = normalizeAction(request.getCommandValue());

        if (!isDeviceOnline(device)) {
            return handleOffline(request, action);
        }

        String payload = buildPayload(target, action);
        DeviceCommandLog commandLog = commandPersistenceService.createPendingLog(
                buildPendingLog(request, action, payload)
        );

        try {
            String topic = buildTopic(device);
            PublishResult result = mqttService.publish(topic, payload);
            if (!result.isSuccess()) {
                throw new MqttPublishException(
                        result.getErrorMessage() != null ? result.getErrorMessage() : "MQTT publish failed"
                );
            }

            commandPersistenceService.markSuccess(commandLog);
            log.info("Device command succeeded. logId={}, topic={}", commandLog.getId(), topic);
            return buildVO(commandLog, "Command published successfully");
        } catch (Exception ex) {
            commandPersistenceService.markFailed(commandLog, ex.getMessage());
            log.error("Device command failed. logId={}, deviceId={}", commandLog.getId(), request.getDeviceId(), ex);
            throw new MqttPublishException("MQTT publish failed: " + ex.getMessage(), ex);
        }
    }

    private void validateTargetDeviceType(ControlTarget target, Device device) {
        String deviceType = device.getDeviceType();
        if (target == ControlTarget.LIGHT && !"FILL_LIGHT".equalsIgnoreCase(deviceType)) {
            throw new InvalidCommandException("Device type mismatch: LIGHT control requires device type FILL_LIGHT");
        }
        if (target == ControlTarget.FAN && !"FAN".equalsIgnoreCase(deviceType)) {
            throw new InvalidCommandException("Device type mismatch: FAN control requires device type FAN");
        }
    }

    private boolean isDeviceOnline(Device device) {
        return "ONLINE".equalsIgnoreCase(device.getOnlineStatus());
    }

    private String normalizeAction(String action) {
        if (action == null) {
            throw new InvalidCommandException("Command value cannot be null");
        }

        String normalized = action.trim().toUpperCase();
        if (!"ON".equals(normalized) && !"OFF".equals(normalized)) {
            throw new InvalidCommandException("Only ON/OFF allowed, got: " + action);
        }
        return normalized;
    }

    private String buildPayload(ControlTarget target, String action) {
        try {
            Map<String, String> map = new HashMap<>();
            map.put("target", target.getValue());
            map.put("action", action);
            return objectMapper.writeValueAsString(map);
        } catch (Exception ex) {
            throw new RuntimeException("Payload build failed", ex);
        }
    }

    private String buildTopic(Device device) {
        if (device.getId() == null) {
            throw new RuntimeException("Device ID is null");
        }
        if (device.getMqttTopicDown() != null && !device.getMqttTopicDown().isBlank()) {
            return device.getMqttTopicDown();
        }
        return "device/" + device.getId() + "/ia1/control";
    }

    private DeviceCommandLog buildPendingLog(DeviceControlRequest req, String action, String payload) {
        DeviceCommandLog commandLog = new DeviceCommandLog();
        commandLog.setPlantId(req.getPlantId());
        commandLog.setDeviceId(req.getDeviceId());
        commandLog.setOperatorUserId(null);
        commandLog.setSourceType("MANUAL");
        commandLog.setCommandName("power");
        commandLog.setCommandValue(action);
        commandLog.setRequestPayload(payload);
        commandLog.setResponsePayload(null);
        commandLog.setExecuteStatus(CommandStatus.PENDING.name());
        commandLog.setErrorMessage(null);
        commandLog.setExecutedAt(null);
        return commandLog;
    }

    private ControlCommandVO handleOffline(DeviceControlRequest req, String action) {
        DeviceCommandLog commandLog = new DeviceCommandLog();
        commandLog.setPlantId(req.getPlantId());
        commandLog.setDeviceId(req.getDeviceId());
        commandLog.setOperatorUserId(null);
        commandLog.setSourceType("MANUAL");
        commandLog.setCommandName("power");
        commandLog.setCommandValue(action);
        commandLog.setRequestPayload(null);
        commandLog.setResponsePayload(null);
        commandLog.setExecuteStatus(CommandStatus.FAILED.name());
        commandLog.setErrorMessage("Device offline");
        commandLog.setExecutedAt(LocalDateTime.now());

        commandPersistenceService.createOfflineLog(commandLog);
        log.warn("Device command skipped because device is offline. deviceId={}, logId={}",
                req.getDeviceId(), commandLog.getId());

        return buildVO(commandLog, "Device is offline");
    }

    private ControlCommandVO buildVO(DeviceCommandLog commandLog, String message) {
        return ControlCommandVO.builder()
                .commandLogId(commandLog.getId())
                .commandName(commandLog.getCommandName())
                .commandValue(commandLog.getCommandValue())
                .executeStatus(commandLog.getExecuteStatus())
                .message(message)
                .build();
    }
}
