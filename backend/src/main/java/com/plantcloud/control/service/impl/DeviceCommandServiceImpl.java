package com.plantcloud.control.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.plantcloud.control.dto.DeviceControlRequest;
import com.plantcloud.control.entity.DeviceCommandLog;
import com.plantcloud.control.enums.CommandStatus;
import com.plantcloud.control.enums.ControlTarget;
import com.plantcloud.control.exception.DeviceNotFoundException;
import com.plantcloud.control.exception.InvalidCommandException;
import com.plantcloud.control.exception.MqttPublishException;
import com.plantcloud.control.mapper.DeviceCommandLogMapper;
import com.plantcloud.control.model.PublishResult;
import com.plantcloud.control.service.DeviceCommandService;
import com.plantcloud.control.service.MqttPublishService;
import com.plantcloud.control.vo.ControlCommandVO;
import com.plantcloud.device.entity.Device;
import com.plantcloud.device.mapper.DeviceMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceCommandServiceImpl implements DeviceCommandService {

    private final DeviceMapper deviceMapper;
    private final DeviceCommandLogMapper logMapper;
    private final MqttPublishService mqttService;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ControlCommandVO controlLight(DeviceControlRequest request) {
        return execute(request, ControlTarget.LIGHT);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ControlCommandVO controlFan(DeviceControlRequest request) {
        return execute(request, ControlTarget.FAN);
    }

    /**
     * 核心控制流程
     * 不加 @Transactional，避免内部调用导致事务失效
     */
    private ControlCommandVO execute(DeviceControlRequest request, ControlTarget target) {
        log.info("开始执行控制命令. plantId={}, deviceId={}, target={}, command={}",
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
        DeviceCommandLog commandLog = buildPendingLog(request, action, payload);
        logMapper.insert(commandLog);

        try {
            String topic = buildTopic(device);
            PublishResult result = mqttService.publish(topic, payload);

            if (!result.isSuccess()) {
                throw new MqttPublishException(
                        result.getErrorMessage() != null
                                ? result.getErrorMessage()
                                : "MQTT publish failed"
                );
            }

            commandLog.setExecuteStatus(CommandStatus.SUCCESS.name());
            commandLog.setExecutedAt(LocalDateTime.now());
            logMapper.updateById(commandLog);

            log.info("控制命令执行成功. logId={}, topic={}", commandLog.getId(), topic);

            return buildVO(commandLog, "控制指令下发成功");

        } catch (Exception e) {
            commandLog.setExecuteStatus(CommandStatus.FAILED.name());
            commandLog.setErrorMessage(e.getMessage());
            commandLog.setExecutedAt(LocalDateTime.now());
            logMapper.updateById(commandLog);

            log.error("控制命令执行失败. logId={}, deviceId={}", commandLog.getId(), request.getDeviceId(), e);

            throw new MqttPublishException("MQTT publish failed: " + e.getMessage(), e);
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
        } catch (Exception e) {
            throw new RuntimeException("Payload build failed", e);
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

        logMapper.insert(commandLog);

        log.warn("设备离线，控制失败. deviceId={}, logId={}", req.getDeviceId(), commandLog.getId());

        return buildVO(commandLog, "设备离线，指令执行失败");
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