package com.plantcloud.control.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
import com.plantcloud.strategy.service.StrategyDeviceEffectService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceCommandServiceImpl implements DeviceCommandService {

    private static final String DEVICE_TYPE_IA1 = "IA1";
    private static final String DEVICE_CODE_E53IA1 = "E53IA1";
    private static final int DEVICE_COMMAND_SOURCE_TYPE_MAX_LENGTH = 20;

    private final DeviceMapper deviceMapper;
    private final MqttPublishService mqttService;
    private final ObjectMapper objectMapper;
    private final DeviceCommandPersistenceService commandPersistenceService;
    private final StrategyDeviceEffectService strategyDeviceEffectService;

    @Override
    public ControlCommandVO controlLight(DeviceControlRequest request) {
        return execute(request, ControlTarget.LIGHT);
    }

    @Override
    public ControlCommandVO controlFan(DeviceControlRequest request) {
        return execute(request, ControlTarget.FAN);
    }

    private ControlCommandVO execute(DeviceControlRequest request, ControlTarget target) {
        log.info("[CTRL] service start plantId={} deviceId={} target={} commandValue={}",
                request.getPlantId(), request.getDeviceId(), target, request.getCommandValue());
        log.info("开始执行控制命令. plantId={}, deviceId={}, target={}, command={}",
                request.getPlantId(), request.getDeviceId(), target, request.getCommandValue());

        Device device = deviceMapper.selectById(request.getDeviceId());
        if (device == null) {
            throw new DeviceNotFoundException("Device not found: " + request.getDeviceId());
        }
        log.info("[CTRL] device resolved id={} code={} type={} onlineStatus={} mqttTopicDown={}",
                device.getId(), device.getDeviceCode(), device.getDeviceType(),
                device.getOnlineStatus(), device.getMqttTopicDown());

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
            log.info("[CTRL] resolved topic={}", topic);
            log.info("[CTRL] resolved payload={}", payload);
            PublishResult result = mqttService.publish(topic, payload);
            log.info("[CTRL] mqtt publish returned success={} errorMessage={}",
                    result.isSuccess(), result.getErrorMessage());

            if (!result.isSuccess()) {
                throw new MqttPublishException(
                        result.getErrorMessage() != null ? result.getErrorMessage() : "MQTT publish failed"
                );
            }

            commandPersistenceService.markSuccess(commandLog);
            updateDeviceCommandStatus(device, target, action);
            supersedeStrategyEffectsIfNeeded(device, target, request, commandLog);
            log.info("[CTRL] command success logId={} topic={} payload={}", commandLog.getId(), topic, payload);
            log.info("控制命令执行成功. logId={}, topic={}", commandLog.getId(), topic);

            return buildVO(commandLog, "控制指令下发成功");

        } catch (Exception e) {
            log.error("[CTRL] command failed logId={} deviceId={} target={} commandValue={}",
                    commandLog.getId(), request.getDeviceId(), target, request.getCommandValue(), e);

            commandPersistenceService.markFailed(commandLog, e.getMessage());

            log.error("控制命令执行失败. logId={}, deviceId={}", commandLog.getId(), request.getDeviceId(), e);

            throw new MqttPublishException("MQTT publish failed: " + e.getMessage(), e);
        }
    }

    private void validateTargetDeviceType(ControlTarget target, Device device) {
        String deviceType = device.getDeviceType();
        if (isIa1Device(device)) {
            return;
        }
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
            Map<String, String> map = new LinkedHashMap<>();
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
        if (isIa1Device(device) && StringUtils.hasText(device.getDeviceCode())) {
            log.warn("[CTRL] mqtt_topic_down is empty, fallback to IA1 topic. deviceId={}, deviceCode={}",
                    device.getId(), device.getDeviceCode());
            return "device/" + device.getDeviceCode() + "/ia1/control";
        }
        return "device/" + device.getId() + "/ia1/control";
    }

    private boolean isIa1Device(Device device) {
        return DEVICE_TYPE_IA1.equalsIgnoreCase(device.getDeviceType())
                || DEVICE_CODE_E53IA1.equalsIgnoreCase(device.getDeviceCode());
    }

    private void updateDeviceCommandStatus(Device device, ControlTarget target, String action) {
        ObjectNode statusNode = buildCurrentStatusNode(device.getCurrentStatus());
        LocalDateTime now = LocalDateTime.now();

        if (target == ControlTarget.FAN) {
            statusNode.put("fanStatus", action);
        } else if (target == ControlTarget.LIGHT) {
            statusNode.put("lightStatus", action);
        }

        statusNode.put("mqttStatus", device.getOnlineStatus());
        statusNode.put("online", isDeviceOnline(device));
        statusNode.put("stateSource", "COMMAND");
        statusNode.put("commandUpdatedAt", now.toString());
        statusNode.put("statusUpdatedAt", now.toString());

        device.setCurrentStatus(statusNode.toString());
        deviceMapper.updateById(device);

        log.info("[CTRL] current_status updated by command. deviceId={}, target={}, action={}, currentStatus={}",
                device.getId(), target, action, device.getCurrentStatus());
    }

    private ObjectNode buildCurrentStatusNode(String currentStatus) {
        try {
            if (StringUtils.hasText(currentStatus)) {
                JsonNode node = objectMapper.readTree(currentStatus);
                if (node.isObject()) {
                    return (ObjectNode) node;
                }
            }
        } catch (Exception ex) {
            log.warn("[CTRL] invalid current_status JSON, will rebuild. currentStatus={}", currentStatus);
        }
        return objectMapper.createObjectNode();
    }

    private DeviceCommandLog buildPendingLog(DeviceControlRequest req, String action, String payload) {
        DeviceCommandLog commandLog = new DeviceCommandLog();
        commandLog.setPlantId(req.getPlantId());
        commandLog.setDeviceId(req.getDeviceId());
        commandLog.setOperatorUserId(null);
        commandLog.setSourceType(resolveSourceType(req));
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
        commandLog.setSourceType(resolveSourceType(req));
        commandLog.setCommandName("power");
        commandLog.setCommandValue(action);
        commandLog.setRequestPayload(null);
        commandLog.setResponsePayload(null);
        commandLog.setExecuteStatus(CommandStatus.FAILED.name());
        commandLog.setErrorMessage("Device offline");

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

    private String resolveSourceType(DeviceControlRequest request) {
        if (StringUtils.hasText(request.getSourceType())) {
            return normalizeSourceTypeForCommandLog(request.getSourceType());
        }
        return "MANUAL";
    }

    private String normalizeSourceTypeForCommandLog(String sourceType) {
        String normalized = sourceType.trim().toUpperCase();
        if (normalized.length() <= DEVICE_COMMAND_SOURCE_TYPE_MAX_LENGTH) {
            return normalized;
        }
        String truncated = normalized.substring(0, DEVICE_COMMAND_SOURCE_TYPE_MAX_LENGTH);
        log.warn("[CTRL] sourceType is longer than device_command_logs.source_type allows, truncating. originalSourceType={} truncatedSourceType={}",
                normalized, truncated);
        return truncated;
    }

    private void supersedeStrategyEffectsIfNeeded(Device device,
                                                  ControlTarget target,
                                                  DeviceControlRequest request,
                                                  DeviceCommandLog commandLog) {
        if (device == null || device.getId() == null || commandLog == null || commandLog.getId() == null) {
            return;
        }
        try {
            strategyDeviceEffectService.supersedeActiveEffectsByCommand(
                    device.getId(),
                    target.name(),
                    resolveSourceType(request),
                    commandLog.getId()
            );
        } catch (Exception ex) {
            log.warn("[CTRL] shadow effect supersede skipped. deviceId={} target={} commandLogId={} reason={}",
                    device.getId(), target, commandLog.getId(), ex.getMessage());
        }
    }
}
