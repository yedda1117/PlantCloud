package com.plantcloud.strategy.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plantcloud.alert.service.AlertService;
import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.control.dto.DeviceControlRequest;
import com.plantcloud.control.service.DeviceCommandService;
import com.plantcloud.control.vo.ControlCommandVO;
import com.plantcloud.device.entity.Device;
import com.plantcloud.device.mapper.DeviceMapper;
import com.plantcloud.monitoring.entity.HumidityData;
import com.plantcloud.monitoring.entity.LightData;
import com.plantcloud.monitoring.entity.TemperatureData;
import com.plantcloud.monitoring.mapper.HumidityDataMapper;
import com.plantcloud.monitoring.mapper.LightDataMapper;
import com.plantcloud.monitoring.mapper.TemperatureDataMapper;
import com.plantcloud.plant.entity.Plant;
import com.plantcloud.plant.mapper.PlantMapper;
import com.plantcloud.strategy.dto.StrategyLogQueryDTO;
import com.plantcloud.strategy.dto.StrategyQueryDTO;
import com.plantcloud.strategy.dto.StrategyUpsertDTO;
import com.plantcloud.strategy.entity.Strategy;
import com.plantcloud.strategy.entity.StrategyDeviceEffect;
import com.plantcloud.strategy.entity.StrategyExecutionLog;
import com.plantcloud.strategy.mapper.StrategyExecutionLogMapper;
import com.plantcloud.strategy.mapper.StrategyMapper;
import com.plantcloud.strategy.service.StrategyDeviceEffectService;
import com.plantcloud.strategy.service.StrategyNotificationService;
import com.plantcloud.strategy.service.StrategyService;
import com.plantcloud.strategy.vo.PageResult;
import com.plantcloud.strategy.vo.StrategyExecutionLogVO;
import com.plantcloud.strategy.vo.StrategyVO;
import com.plantcloud.system.exception.BizException;
import com.plantcloud.user.entity.User;
import com.plantcloud.user.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class StrategyServiceImpl implements StrategyService {

    private static final String TYPE_CONDITION = "CONDITION";
    private static final String TYPE_SCHEDULE = "SCHEDULE";
    private static final String OPERATOR_GT = "GT";
    private static final String OPERATOR_GTE = "GTE";
    private static final String OPERATOR_LT = "LT";
    private static final String OPERATOR_LTE = "LTE";
    private static final String OPERATOR_EQ = "EQ";
    private static final String OPERATOR_BETWEEN = "BETWEEN";
    private static final String OPERATOR_CRON = "CRON";
    private static final String ACTION_AUTO_LIGHT = "AUTO_LIGHT";
    private static final String ACTION_AUTO_FAN = "AUTO_FAN";
    private static final String ACTION_NOTIFY_USER = "NOTIFY_USER";
    private static final String METRIC_NONE = "NONE";
    private static final Set<String> STRATEGY_TYPES = Set.of(TYPE_CONDITION, TYPE_SCHEDULE);
    private static final Set<String> ACTION_TYPES = Set.of(ACTION_AUTO_LIGHT, ACTION_AUTO_FAN, ACTION_NOTIFY_USER);
    private static final Set<String> CONDITION_OPERATORS = Set.of(OPERATOR_GT, OPERATOR_GTE, OPERATOR_LT, OPERATOR_LTE, OPERATOR_EQ, OPERATOR_BETWEEN);
    private static final Set<String> CONDITION_METRICS = Set.of("TEMPERATURE", "HUMIDITY", "LIGHT", "SMOKE", "AIR", "TILT", "CO2");
    private static final Set<String> AUTO_LIGHT_VALUES = Set.of("ON", "OFF");
    private static final Set<String> AUTO_FAN_VALUES = Set.of("ON", "OFF", "LOW", "HIGH");
    private static final Set<String> NOTIFY_VALUES = Set.of("INFO", "WARNING", "DANGER");
    private static final String EXECUTION_SUCCESS = "SUCCESS";
    private static final String EXECUTION_FAILED = "FAILED";
    private static final String TRIGGER_SOURCE_STRATEGY_UPDATE = "STRATEGY_UPDATE";
    private static final String OPERATION_ENABLE = "ENABLE";
    private static final String OPERATION_DISABLE = "DISABLE";
    private static final String OPERATION_UPDATE = "UPDATE";
    private static final String SOURCE_TYPE_STRATEGY = "STRATEGY";
    private static final String SOURCE_TYPE_STRATEGY_DISABLE = "STRATEGY_DISABLE";
    private static final String SOURCE_TYPE_STRATEGY_DISABLE_ROLLBACK = "STRATEGY_ROLLBACK";
    private static final String COMMAND_ON = "ON";
    private static final String COMMAND_OFF = "OFF";
    private static final String CONTROL_TARGET_LIGHT = "LIGHT";
    private static final String CONTROL_TARGET_FAN = "FAN";
    private static final String CLEANUP_STATUS_NOT_REQUIRED = "NOT_REQUIRED";
    private static final String CLEANUP_STATUS_SKIPPED = "SKIPPED";
    private static final String CLEANUP_STATUS_SUCCESS = "SUCCESS";
    private static final String CLEANUP_STATUS_FAILED = "FAILED";
    private static final String CLEANUP_MODE_NONE = "NONE";
    private static final String CLEANUP_MODE_ROLLBACK = "ROLLBACK_TO_BEFORE_STATE";
    private static final String CLEANUP_MODE_LEGACY_FALLBACK = "LEGACY_FIXED_FALLBACK";
    private static final String EFFECT_CLOSE_REASON_DISABLED = "DISABLED";
    private static final String EFFECT_CLOSE_REASON_REVERTED = "REVERTED";

    private final StrategyMapper strategyMapper;
    private final StrategyExecutionLogMapper strategyExecutionLogMapper;
    private final StrategyNotificationService strategyNotificationService;
    private final StrategyDeviceEffectService strategyDeviceEffectService;
    private final DeviceCommandService deviceCommandService;
    private final PlantMapper plantMapper;
    private final UserMapper userMapper;
    private final DeviceMapper deviceMapper;
    private final TemperatureDataMapper temperatureDataMapper;
    private final HumidityDataMapper humidityDataMapper;
    private final LightDataMapper lightDataMapper;
    private final AlertService alertService;
    private final ObjectMapper objectMapper;

    @Override
    public List<StrategyVO> listStrategies(StrategyQueryDTO query) {
        requirePlant(query.getPlantId());
        return strategyMapper.selectByPlantIdAndFilters(query.getPlantId(), query.getEnabled(), query.getStrategyType())
                .stream()
                .map(this::toStrategyVO)
                .collect(Collectors.toList());
    }

    @Override
    public StrategyVO getStrategy(Long strategyId) {
        return toStrategyVO(requireStrategy(strategyId));
    }

    @Override
    @Transactional
    public StrategyVO createStrategy(StrategyUpsertDTO request) {
        Strategy strategy = buildStrategy(request, null);
        validateStrategy(strategy, request);
        validateConflict(strategy, null);
        strategyMapper.insert(strategy);
        evaluateStrategyAgainstLatestData(strategy, "STRATEGY_SAVE", Map.of());
        return toStrategyVO(requireStrategy(strategy.getId()));
    }

    @Override
    @Transactional
    public StrategyVO updateStrategy(Long strategyId, StrategyUpsertDTO request) {
        Strategy existing = requireStrategy(strategyId);
        Strategy strategy = buildStrategy(request, existing);
        strategy.setId(strategyId);
        String traceId = "strategy-update-" + strategyId + "-" + System.currentTimeMillis();
        String operationType = resolveStrategyUpdateOperationType(existing, strategy);
        log.info("[STRATEGY_UPDATE] start traceId={} strategyId={} operationType={} previousEnabled={} nextEnabled={}",
                traceId, strategyId, operationType, existing.getEnabled(), strategy.getEnabled());
        validateStrategy(strategy, request);
        validateConflict(strategy, strategyId);
        strategyMapper.updateById(strategy);
        DisableCleanupResult disableCleanupResult = handleDisableCleanupIfNeeded(existing, operationType, traceId);
        closeStrategyEffectsAfterDisable(existing, operationType, traceId, disableCleanupResult);
        recordStrategyStatusChangeLogIfNeeded(strategy, operationType, traceId, disableCleanupResult);
        evaluateStrategyAgainstLatestData(strategy, "STRATEGY_SAVE", Map.of());
        log.info("[STRATEGY_UPDATE] success traceId={} strategyId={} operationType={} sourceMethod=StrategyServiceImpl.updateStrategy",
                traceId, strategyId, operationType);
        return toStrategyVO(requireStrategy(strategyId));
    }

    @Override
    @Transactional
    public void deleteStrategy(Long strategyId) {
        requireStrategy(strategyId);
        strategyMapper.deleteById(strategyId);
    }

    @Override
    public PageResult<StrategyExecutionLogVO> getStrategyLogs(Long strategyId, StrategyLogQueryDTO query) {
        requireStrategy(strategyId);
        long current = query.getCurrent() == null ? 1L : query.getCurrent();
        long pageSize = query.getPageSize() == null ? 10L : Math.min(query.getPageSize(), 100L);
        long offset = (current - 1) * pageSize;
        List<StrategyExecutionLogVO> records = strategyExecutionLogMapper.selectPageByStrategyId(strategyId, offset, pageSize)
                .stream()
                .map(this::toStrategyExecutionLogVO)
                .toList();
        long total = strategyExecutionLogMapper.countByStrategyId(strategyId);
        return PageResult.<StrategyExecutionLogVO>builder()
                .current(current)
                .pageSize(pageSize)
                .total(total)
                .records(records)
                .build();
    }

    @Override
    @Transactional
    public void evaluateStrategiesForPlant(Long plantId, String triggerSource) {
        evaluateStrategiesForPlant(plantId, triggerSource, Map.of());
    }

    @Override
    @Transactional
    public void evaluateStrategiesForPlant(Long plantId, String triggerSource, Map<String, BigDecimal> currentMetricValues) {
        if (plantId == null) {
            return;
        }
        String resolvedTriggerSource = StringUtils.hasText(triggerSource) ? triggerSource : "REALTIME_DATA";
        Map<String, BigDecimal> metricValues = currentMetricValues == null ? Map.of() : currentMetricValues;
        log.info("[STRATEGY_RT] start strategy evaluation. plantId={}, triggerSource={}",
                plantId, resolvedTriggerSource);
        List<Strategy> strategies = strategyMapper.selectByPlantIdAndFilters(plantId, true, TYPE_CONDITION);
        log.info("[STRATEGY_RT] condition strategies loaded. plantId={}, count={}", plantId, strategies.size());
        for (Strategy strategy : strategies) {
            evaluateStrategyAgainstLatestData(strategy, resolvedTriggerSource, metricValues);
        }
    }

    private void evaluateStrategyAgainstLatestData(Strategy strategy,
                                                   String triggerSource,
                                                   Map<String, BigDecimal> currentMetricValues) {
        if (!Boolean.TRUE.equals(strategy.getEnabled()) || !TYPE_CONDITION.equals(strategy.getStrategyType())) {
            return;
        }
        log.info("[STRATEGY_RT] evaluating strategy. strategyId={}, metricType={}, operatorType={}, thresholdMin={}, thresholdMax={}",
                strategy.getId(),
                strategy.getMetricType(),
                strategy.getOperatorType(),
                strategy.getThresholdMin(),
                strategy.getThresholdMax());
        if (!isWithinActiveTimeWindow(strategy)) {
            log.info("[STRATEGY_RT] strategy skipped by time window. strategyId={}", strategy.getId());
            return;
        }
        BigDecimal currentValue = resolveCurrentMetricValue(strategy, currentMetricValues);
        log.info("[STRATEGY_RT] Evaluating strategy: {} metricType={} value={} thresholdMin={} thresholdMax={}",
                strategy.getStrategyName(),
                strategy.getMetricType(),
                currentValue,
                strategy.getThresholdMin(),
                strategy.getThresholdMax());
        boolean matched = currentValue != null && isConditionTriggered(strategy, currentValue);
        log.info("[STRATEGY_RT] strategy metric evaluated. strategyId={}, metricType={}, currentValue={}, matched={}",
                strategy.getId(), strategy.getMetricType(), currentValue, matched);
        if (!matched) {
            return;
        }

        String commandValue = resolveCommandValue(strategy);
        String payload = buildTriggerPayload(strategy, currentValue, triggerSource, commandValue);
        StrategyExecutionLog latestLog = strategyExecutionLogMapper.selectLatestByStrategyId(strategy.getId());
        if (isDuplicateTrigger(strategy, latestLog, currentValue, payload, commandValue)) {
            log.info("[STRATEGY_RT] strategy skipped as duplicate. strategyId={}, currentValue={}",
                    strategy.getId(), currentValue);
            return;
        }

        executeTriggeredStrategy(strategy, currentValue, triggerSource, payload, commandValue);
    }

    private void executeTriggeredStrategy(Strategy strategy,
                                          BigDecimal currentValue,
                                          String triggerSource,
                                          String payload,
                                          String commandValue) {
        Long effectDeviceId = null;
        String effectControlTarget = null;
        String effectBeforeState = null;
        if (isDeviceControlAction(strategy)) {
            try {
                effectDeviceId = resolveCommandDeviceId(strategy);
                effectControlTarget = resolveControlTarget(strategy.getActionType());
                effectBeforeState = resolveCurrentDeviceStateForEffect(strategy, effectDeviceId);
            } catch (Exception ex) {
                log.warn("[STRATEGY_RT] shadow effect snapshot skipped. strategyId={} reason={}",
                        strategy.getId(), safeMessage(ex));
            }
        }

        StrategyExecutionLog executionLog = new StrategyExecutionLog();
        executionLog.setStrategyId(strategy.getId());
        executionLog.setPlantId(strategy.getPlantId());
        executionLog.setTriggerSource(triggerSource);
        executionLog.setTriggerMetricValue(currentValue);
        executionLog.setTriggerPayload(payload);
        executionLog.setExecutedAt(LocalDateTime.now());

        try {
            if (ACTION_NOTIFY_USER.equals(strategy.getActionType())) {
                strategyNotificationService.createNotificationByStrategy(strategy.getId(), currentValue, payload);
                executionLog.setExecutionResult(EXECUTION_SUCCESS);
                executionLog.setResultMessage(buildTriggerResultMessage(strategy, currentValue, "notification created", null));
            } else {
                ControlCommandVO command = executeDeviceCommand(strategy, commandValue);
                executionLog.setCommandLogId(command.getCommandLogId());
                boolean success = EXECUTION_SUCCESS.equalsIgnoreCase(command.getExecuteStatus());
                executionLog.setExecutionResult(success ? EXECUTION_SUCCESS : EXECUTION_FAILED);
                executionLog.setResultMessage(buildTriggerResultMessage(strategy, currentValue, command.getMessage(), commandValue));
                if (success) {
                    recordStrategyEffectIfNeeded(strategy, effectDeviceId, effectControlTarget, effectBeforeState, commandValue, command.getCommandLogId());
                }
            }
        } catch (Exception ex) {
            executionLog.setExecutionResult(EXECUTION_FAILED);
            executionLog.setResultMessage(buildTriggerResultMessage(strategy, currentValue, "action failed: " + safeMessage(ex), commandValue));
            log.warn("[STRATEGY] action failed. strategyId={}, plantId={}, actionType={}, actionValue={}, commandValue={}",
                    strategy.getId(), strategy.getPlantId(), strategy.getActionType(), strategy.getActionValue(), commandValue, ex);
        }

        int inserted = strategyExecutionLogMapper.insert(executionLog);
        log.info("[STRATEGY_RT] strategy_execution_logs insert result. strategyId={}, logId={}, inserted={}, executionResult={}, commandLogId={}",
                strategy.getId(),
                executionLog.getId(),
                inserted,
                executionLog.getExecutionResult(),
                executionLog.getCommandLogId());
    }

    private boolean isDuplicateTrigger(Strategy strategy,
                                       StrategyExecutionLog latestLog,
                                       BigDecimal currentValue,
                                       String payload,
                                       String commandValue) {
        if (latestLog == null) {
            return false;
        }
        if (!isSuccessfulExecutionResult(latestLog.getExecutionResult())) {
            return false;
        }
        if (isDeviceControlAction(strategy)) {
            return isDuplicateDeviceControlTrigger(strategy, latestLog, commandValue);
        }
        if (latestLog.getTriggerMetricValue() != null
                && latestLog.getTriggerMetricValue().compareTo(currentValue) == 0) {
            return true;
        }
        return payload.equals(latestLog.getTriggerPayload());
    }

    private boolean isDuplicateDeviceControlTrigger(Strategy strategy,
                                                    StrategyExecutionLog latestLog,
                                                    String commandValue) {
        if (latestLog.getCommandLogId() == null) {
            return false;
        }
        Device targetDevice = resolveCommandTargetDeviceForDedup(strategy);
        if (targetDevice == null) {
            log.info("[STRATEGY_RT] device-state dedupe skipped because target device was not found. strategyId={}, targetDeviceId={}",
                    strategy.getId(), strategy.getTargetDeviceId());
            return false;
        }

        String currentState = resolveCurrentDeviceActionState(targetDevice, strategy.getActionType());
        String normalizedCurrentState = normalizeDeviceState(currentState);
        String normalizedCommandValue = normalizeDeviceState(commandValue);
        if (!StringUtils.hasText(normalizedCurrentState) || !StringUtils.hasText(normalizedCommandValue)) {
            log.info("[STRATEGY_RT] device-state dedupe skipped because current state is unavailable. strategyId={}, targetDeviceId={}, actionType={}, commandValue={}, currentState={}",
                    strategy.getId(), targetDevice.getId(), strategy.getActionType(), commandValue, currentState);
            return false;
        }

        boolean duplicate = normalizedCommandValue.equals(normalizedCurrentState);
        log.info("[STRATEGY_RT] device-state dedupe evaluated. strategyId={}, targetDeviceId={}, actionType={}, commandValue={}, currentState={}, duplicate={}",
                strategy.getId(), targetDevice.getId(), strategy.getActionType(), normalizedCommandValue, normalizedCurrentState, duplicate);
        return duplicate;
    }

    private boolean isDeviceControlAction(Strategy strategy) {
        return ACTION_AUTO_LIGHT.equals(strategy.getActionType())
                || ACTION_AUTO_FAN.equals(strategy.getActionType());
    }

    private boolean isSuccessfulExecutionResult(String executionResult) {
        return EXECUTION_SUCCESS.equalsIgnoreCase(executionResult)
                || "TRIGGERED".equalsIgnoreCase(executionResult);
    }

    private BigDecimal resolveCurrentMetricValue(Strategy strategy, Map<String, BigDecimal> currentMetricValues) {
        if (currentMetricValues.containsKey(strategy.getMetricType())) {
            return currentMetricValues.get(strategy.getMetricType());
        }
        return getLatestMetricValue(strategy);
    }

    private BigDecimal getLatestMetricValue(Strategy strategy) {
        return switch (strategy.getMetricType()) {
            case "TEMPERATURE" -> {
                TemperatureData data = temperatureDataMapper.selectOne(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<TemperatureData>()
                        .eq(TemperatureData::getPlantId, strategy.getPlantId())
                        .orderByDesc(TemperatureData::getCollectedAt)
                        .orderByDesc(TemperatureData::getCreatedAt)
                        .orderByDesc(TemperatureData::getId)
                        .last("limit 1"));
                yield data == null ? null : data.getTemperature();
            }
            case "HUMIDITY" -> {
                HumidityData data = humidityDataMapper.selectOne(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<HumidityData>()
                        .eq(HumidityData::getPlantId, strategy.getPlantId())
                        .orderByDesc(HumidityData::getCollectedAt)
                        .orderByDesc(HumidityData::getCreatedAt)
                        .orderByDesc(HumidityData::getId)
                        .last("limit 1"));
                yield data == null ? null : data.getHumidity();
            }
            case "LIGHT" -> {
                LightData data = lightDataMapper.selectOne(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<LightData>()
                        .eq(LightData::getPlantId, strategy.getPlantId())
                        .orderByDesc(LightData::getCollectedAt)
                        .orderByDesc(LightData::getCreatedAt)
                        .orderByDesc(LightData::getId)
                        .last("limit 1"));
                yield data == null ? null : data.getLightLux();
            }
            case "SMOKE" -> alertService.findFirstUnresolvedSmokeGasPpmForPlant(strategy.getPlantId()).orElse(null);
            default -> null;
        };
    }

    private boolean isConditionTriggered(Strategy strategy, BigDecimal value) {
        return switch (strategy.getOperatorType()) {
            case OPERATOR_LT -> upperThreshold(strategy) != null
                    && value.compareTo(upperThreshold(strategy)) < 0;
            case OPERATOR_LTE -> upperThreshold(strategy) != null
                    && value.compareTo(upperThreshold(strategy)) <= 0;
            case OPERATOR_GT -> lowerThreshold(strategy) != null
                    && value.compareTo(lowerThreshold(strategy)) > 0;
            case OPERATOR_GTE -> lowerThreshold(strategy) != null
                    && value.compareTo(lowerThreshold(strategy)) >= 0;
            case OPERATOR_EQ -> exactThreshold(strategy) != null
                    && value.compareTo(exactThreshold(strategy)) == 0;
            case OPERATOR_BETWEEN -> strategy.getThresholdMin() != null
                    && strategy.getThresholdMax() != null
                    && value.compareTo(strategy.getThresholdMin()) >= 0
                    && value.compareTo(strategy.getThresholdMax()) <= 0;
            default -> false;
        };
    }

    private BigDecimal lowerThreshold(Strategy strategy) {
        return strategy.getThresholdMin() != null ? strategy.getThresholdMin() : strategy.getThresholdMax();
    }

    private BigDecimal upperThreshold(Strategy strategy) {
        return strategy.getThresholdMax() != null ? strategy.getThresholdMax() : strategy.getThresholdMin();
    }

    private BigDecimal exactThreshold(Strategy strategy) {
        return strategy.getThresholdMin() != null ? strategy.getThresholdMin() : strategy.getThresholdMax();
    }

    private ControlCommandVO executeDeviceCommand(Strategy strategy, String commandValue) {
        return executeDeviceCommand(strategy, commandValue, SOURCE_TYPE_STRATEGY);
    }

    private ControlCommandVO executeDeviceCommand(Strategy strategy, String commandValue, String sourceType) {
        Long targetDeviceId = resolveCommandDeviceId(strategy);
        DeviceControlRequest request = new DeviceControlRequest();
        request.setPlantId(strategy.getPlantId());
        request.setDeviceId(targetDeviceId);
        request.setCommandValue(commandValue);
        request.setSourceType(sourceType);
        log.info("[STRATEGY_RT] Sending command: {} to deviceId={} actionValue={} sourceType={}",
                strategy.getActionType(), targetDeviceId, strategy.getActionValue(), sourceType);
        if (ACTION_AUTO_LIGHT.equals(strategy.getActionType())) {
            log.info("[STRATEGY_RT] calling controlLight. strategyId={}, plantId={}, deviceId={}, commandValue={}, sourceType={}",
                    strategy.getId(), strategy.getPlantId(), request.getDeviceId(), commandValue, sourceType);
            return deviceCommandService.controlLight(request);
        }
        if (ACTION_AUTO_FAN.equals(strategy.getActionType())) {
            log.info("[STRATEGY_RT] calling controlFan. strategyId={}, plantId={}, deviceId={}, commandValue={}, sourceType={}",
                    strategy.getId(), strategy.getPlantId(), request.getDeviceId(), commandValue, sourceType);
            return deviceCommandService.controlFan(request);
        }
        throw badRequest("Unsupported strategy action for device control: " + strategy.getActionType());
    }

    private Long resolveCommandDeviceId(Strategy strategy) {
        if (strategy.getTargetDeviceId() != null) {
            return strategy.getTargetDeviceId();
        }
        Device ia1Device = deviceMapper.selectOne(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Device>()
                .eq(Device::getPlantId, strategy.getPlantId())
                .and(wrapper -> wrapper.eq(Device::getDeviceCode, "E53IA1")
                        .or()
                        .eq(Device::getDeviceType, "IA1"))
                .orderByDesc(Device::getOnlineStatus)
                .orderByDesc(Device::getLastSeenAt)
                .orderByDesc(Device::getId)
                .last("limit 1"));
        if (ia1Device == null) {
            throw badRequest("No targetDeviceId and no IA1 device found for plantId=" + strategy.getPlantId());
        }
        log.info("[STRATEGY_RT] targetDeviceId empty, resolved IA1 device. strategyId={}, plantId={}, deviceId={}",
                strategy.getId(), strategy.getPlantId(), ia1Device.getId());
        return ia1Device.getId();
    }

    private Device resolveCommandTargetDeviceForDedup(Strategy strategy) {
        if (strategy.getTargetDeviceId() != null) {
            return deviceMapper.selectById(strategy.getTargetDeviceId());
        }
        return deviceMapper.selectOne(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Device>()
                .eq(Device::getPlantId, strategy.getPlantId())
                .and(wrapper -> wrapper.eq(Device::getDeviceCode, "E53IA1")
                        .or()
                        .eq(Device::getDeviceType, "IA1"))
                .orderByDesc(Device::getOnlineStatus)
                .orderByDesc(Device::getLastSeenAt)
                .orderByDesc(Device::getId)
                .last("limit 1"));
    }

    private String resolveCommandValue(Strategy strategy) {
        if (ACTION_AUTO_LIGHT.equals(strategy.getActionType())) {
            return strategy.getActionValue();
        }
        if (ACTION_AUTO_FAN.equals(strategy.getActionType())) {
            String actionValue = strategy.getActionValue() == null ? "" : strategy.getActionValue().trim().toUpperCase();
            if ("OFF".equals(actionValue)) {
                return "OFF";
            }
            return "ON";
        }
        return null;
    }

    private String buildTriggerPayload(Strategy strategy, BigDecimal currentValue, String triggerSource, String commandValue) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("strategyId", strategy.getId());
        payload.put("strategyName", strategy.getStrategyName());
        payload.put("triggerSource", triggerSource);
        payload.put("metricType", strategy.getMetricType());
        payload.put("operatorType", strategy.getOperatorType());
        payload.put("thresholdMin", strategy.getThresholdMin());
        payload.put("thresholdMax", strategy.getThresholdMax());
        payload.put("actionType", strategy.getActionType());
        payload.put("actionValue", strategy.getActionValue());
        payload.put("commandValue", commandValue);
        payload.put("value", currentValue);
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            return payload.toString();
        }
    }

    private String buildTriggerResultMessage(Strategy strategy, BigDecimal currentValue, String actionResult, String commandValue) {
        StringBuilder message = new StringBuilder();
        message.append("Strategy triggered: ").append(strategy.getStrategyName())
                .append(", metric=").append(strategy.getMetricType())
                .append(", value=").append(currentValue)
                .append(", condition=").append(formatTriggerRange(strategy))
                .append(", action=").append(strategy.getActionType()).append(" ").append(strategy.getActionValue());
        if (StringUtils.hasText(commandValue)) {
            message.append(", commandValue=").append(commandValue);
        }
        if (StringUtils.hasText(actionResult)) {
            message.append(", result=").append(actionResult);
        }
        return message.toString();
    }

    private String safeMessage(Exception ex) {
        return StringUtils.hasText(ex.getMessage()) ? ex.getMessage() : ex.getClass().getSimpleName();
    }

    private String safeText(String text, String fallback) {
        if (StringUtils.hasText(text)) {
            return text;
        }
        if (StringUtils.hasText(fallback)) {
            return fallback;
        }
        return "UNKNOWN";
    }

    private String resolveStrategyUpdateOperationType(Strategy existing, Strategy strategy) {
        if (!Objects.equals(existing.getEnabled(), strategy.getEnabled())) {
            return Boolean.TRUE.equals(strategy.getEnabled()) ? OPERATION_ENABLE : OPERATION_DISABLE;
        }
        return OPERATION_UPDATE;
    }

    private DisableCleanupResult handleDisableCleanupIfNeeded(Strategy existing,
                                                              String operationType,
                                                              String traceId) {
        if (!OPERATION_DISABLE.equals(operationType) || !isDeviceControlAction(existing)) {
            return DisableCleanupResult.notRequired(EFFECT_CLOSE_REASON_DISABLED, SOURCE_TYPE_STRATEGY_DISABLE);
        }
        DisableCleanupResult enhancedResult = tryRollbackCleanupWithEffect(existing, traceId);
        if (enhancedResult != null) {
            return enhancedResult;
        }
        log.info("[STRATEGY_UPDATE] rollback-to-before-state cleanup was not applicable, falling back to legacy disable cleanup. traceId={} strategyId={} actionType={} targetDeviceId={}",
                traceId, existing.getId(), existing.getActionType(), existing.getTargetDeviceId());
        return handleLegacyDisableCleanup(existing, traceId);
    }

    private DisableCleanupResult tryRollbackCleanupWithEffect(Strategy existing, String traceId) {
        Optional<StrategyDeviceEffect> effectOptional;
        try {
            effectOptional = strategyDeviceEffectService.findLatestActiveEffectForStrategy(existing.getId());
        } catch (Exception ex) {
            log.warn("[STRATEGY_UPDATE] rollback enhancement lookup failed traceId={} strategyId={} reason={}",
                    traceId, existing.getId(), safeMessage(ex));
            return null;
        }
        if (effectOptional.isEmpty()) {
            log.info("[STRATEGY_UPDATE] rollback enhancement skipped because no active effect was found. traceId={} strategyId={}",
                    traceId, existing.getId());
            return null;
        }

        StrategyDeviceEffect effect = effectOptional.get();
        String rollbackState = normalizeDeviceState(effect.getBeforeState());
        String appliedState = normalizeDeviceState(effect.getAppliedState());
        if (!StringUtils.hasText(rollbackState)
                || !StringUtils.hasText(appliedState)
                || rollbackState.equals(appliedState)) {
            log.info("[STRATEGY_UPDATE] rollback enhancement skipped because effect snapshot is incomplete. traceId={} strategyId={} effectId={}",
                    traceId, existing.getId(), effect.getId());
            return null;
        }

        Device targetDevice = effect.getDeviceId() == null ? null : deviceMapper.selectById(effect.getDeviceId());
        if (targetDevice == null) {
            log.info("[STRATEGY_UPDATE] rollback enhancement skipped because target device was not found. traceId={} strategyId={} effectId={} deviceId={}",
                    traceId, existing.getId(), effect.getId(), effect.getDeviceId());
            return null;
        }

        String currentState = resolveCurrentDeviceStateForEffectTarget(targetDevice, effect, existing);
        if (!StringUtils.hasText(currentState) || !appliedState.equals(currentState)) {
            log.info("[STRATEGY_UPDATE] rollback enhancement skipped because current state no longer matches applied state. traceId={} strategyId={} effectId={} currentState={} appliedState={}",
                    traceId, existing.getId(), effect.getId(), currentState, appliedState);
            return null;
        }

        try {
            ControlCommandVO command = executeDeviceCommand(existing, rollbackState, SOURCE_TYPE_STRATEGY_DISABLE_ROLLBACK);
            boolean success = EXECUTION_SUCCESS.equalsIgnoreCase(command.getExecuteStatus());
            String stateSnapshot = String.format("beforeState=%s, appliedState=%s, currentState=%s",
                    rollbackState, appliedState, currentState);
            String message = success
                    ? "\u505c\u7528\u7b56\u7565\u540e\u5df2\u6062\u590d\u5230\u7b56\u7565\u751f\u6548\u524d\u72b6\u6001: " + stateSnapshot
                    : "\u505c\u7528\u7b56\u7565\u540e\u5c1d\u8bd5\u6062\u590d\u5230\u7b56\u7565\u751f\u6548\u524d\u72b6\u6001\u5931\u8d25: "
                    + safeText(command.getMessage(), command.getExecuteStatus());
            log.info("[STRATEGY_UPDATE] rollback enhancement executed traceId={} strategyId={} effectId={} deviceId={} executeStatus={} commandLogId={}",
                    traceId, existing.getId(), effect.getId(), targetDevice.getId(), command.getExecuteStatus(), command.getCommandLogId());
            if (success) {
                return DisableCleanupResult.rollbackSuccess(
                        command.getCommandLogId(),
                        message,
                        effect.getId(),
                        EFFECT_CLOSE_REASON_REVERTED,
                        SOURCE_TYPE_STRATEGY_DISABLE_ROLLBACK
                );
            }
            return DisableCleanupResult.rollbackFailed(
                    command.getCommandLogId(),
                    message,
                    effect.getId(),
                    EFFECT_CLOSE_REASON_DISABLED,
                    SOURCE_TYPE_STRATEGY_DISABLE_ROLLBACK
            );
        } catch (Exception ex) {
            String message = "\u505c\u7528\u7b56\u7565\u540e\u5c1d\u8bd5\u6062\u590d\u5230\u7b56\u7565\u751f\u6548\u524d\u72b6\u6001\u5f02\u5e38: " + safeMessage(ex);
            log.warn("[STRATEGY_UPDATE] rollback enhancement failed traceId={} strategyId={} effectId={} deviceId={}",
                    traceId, existing.getId(), effect.getId(), targetDevice.getId(), ex);
            return DisableCleanupResult.rollbackFailed(
                    null,
                    message,
                    effect.getId(),
                    EFFECT_CLOSE_REASON_DISABLED,
                    SOURCE_TYPE_STRATEGY_DISABLE_ROLLBACK
            );
        }
    }

    private DisableCleanupResult handleLegacyDisableCleanup(Strategy existing, String traceId) {
        if (!isOpeningDeviceControlAction(existing)) {
            return DisableCleanupResult.notRequired(EFFECT_CLOSE_REASON_DISABLED, SOURCE_TYPE_STRATEGY_DISABLE);
        }
        if (hasOtherEnabledOpeningStrategyDemand(existing)) {
            String message = "\u68c0\u6d4b\u5230\u540c\u8bbe\u5907\u4ecd\u6709\u5176\u4ed6\u547d\u4e2d\u7684\u5f00\u542f\u578b\u7b56\u7565\uff0c\u8df3\u8fc7\u5173\u95ed\u8bbe\u5907\u6536\u5c3e";
            log.info("[STRATEGY_UPDATE] legacy disable cleanup skipped traceId={} strategyId={} actionType={} targetDeviceId={} reason={}",
                    traceId, existing.getId(), existing.getActionType(), existing.getTargetDeviceId(), message);
            return DisableCleanupResult.skipped(message, EFFECT_CLOSE_REASON_DISABLED, SOURCE_TYPE_STRATEGY_DISABLE);
        }

        try {
            ControlCommandVO command = executeDeviceCommand(existing, COMMAND_OFF, SOURCE_TYPE_STRATEGY_DISABLE);
            boolean success = EXECUTION_SUCCESS.equalsIgnoreCase(command.getExecuteStatus());
            String message = success
                    ? "\u505c\u7528\u5f00\u542f\u578b\u7b56\u7565\u540e\u5df2\u4e3b\u52a8\u4e0b\u53d1\u5173\u95ed\u8bbe\u5907\u6307\u4ee4"
                    : "\u505c\u7528\u5f00\u542f\u578b\u7b56\u7565\u540e\u5c1d\u8bd5\u5173\u95ed\u8bbe\u5907\u5931\u8d25: "
                    + safeText(command.getMessage(), command.getExecuteStatus());
            log.info("[STRATEGY_UPDATE] legacy disable cleanup finished traceId={} strategyId={} targetDeviceId={} executeStatus={} commandLogId={}",
                    traceId, existing.getId(), existing.getTargetDeviceId(), command.getExecuteStatus(), command.getCommandLogId());
            if (success) {
                return DisableCleanupResult.success(command.getCommandLogId(), message, EFFECT_CLOSE_REASON_DISABLED, SOURCE_TYPE_STRATEGY_DISABLE);
            }
            return DisableCleanupResult.failed(command.getCommandLogId(), message, EFFECT_CLOSE_REASON_DISABLED, SOURCE_TYPE_STRATEGY_DISABLE);
        } catch (Exception ex) {
            String message = "\u505c\u7528\u5f00\u542f\u578b\u7b56\u7565\u540e\u5c1d\u8bd5\u5173\u95ed\u8bbe\u5907\u5f02\u5e38: " + safeMessage(ex);
            log.warn("[STRATEGY_UPDATE] legacy disable cleanup failed traceId={} strategyId={} targetDeviceId={} actionType={}",
                    traceId, existing.getId(), existing.getTargetDeviceId(), existing.getActionType(), ex);
            return DisableCleanupResult.failed(null, message, EFFECT_CLOSE_REASON_DISABLED, SOURCE_TYPE_STRATEGY_DISABLE);
        }
    }

    private boolean hasOtherEnabledOpeningStrategyDemand(Strategy disabledStrategy) {
        return strategyMapper.selectByPlantIdAndFilters(disabledStrategy.getPlantId(), true, TYPE_CONDITION)
                .stream()
                .filter(candidate -> !Objects.equals(candidate.getId(), disabledStrategy.getId()))
                .filter(this::isOpeningDeviceControlAction)
                .filter(candidate -> sameDeviceControlTarget(candidate, disabledStrategy))
                .anyMatch(this::isConditionStrategyCurrentlyTriggered);
    }

    private boolean sameDeviceControlTarget(Strategy candidate, Strategy reference) {
        return Objects.equals(candidate.getTargetDeviceId(), reference.getTargetDeviceId())
                && Objects.equals(candidate.getActionType(), reference.getActionType());
    }

    private boolean isConditionStrategyCurrentlyTriggered(Strategy strategy) {
        if (!TYPE_CONDITION.equals(strategy.getStrategyType()) || !isWithinActiveTimeWindow(strategy)) {
            return false;
        }
        BigDecimal currentValue = resolveCurrentMetricValue(strategy, Map.of());
        return currentValue != null && isConditionTriggered(strategy, currentValue);
    }

    private boolean isOpeningDeviceControlAction(Strategy strategy) {
        if (!isDeviceControlAction(strategy) || !StringUtils.hasText(strategy.getActionValue())) {
            return false;
        }
        String actionValue = strategy.getActionValue().trim().toUpperCase(Locale.ROOT);
        if (ACTION_AUTO_LIGHT.equals(strategy.getActionType())) {
            return COMMAND_ON.equals(actionValue);
        }
        if (ACTION_AUTO_FAN.equals(strategy.getActionType())) {
            return !COMMAND_OFF.equals(actionValue);
        }
        return false;
    }

    private void closeStrategyEffectsAfterDisable(Strategy existing,
                                                  String operationType,
                                                  String traceId,
                                                  DisableCleanupResult disableCleanupResult) {
        if (!OPERATION_DISABLE.equals(operationType) || !isDeviceControlAction(existing)) {
            return;
        }
        try {
            strategyDeviceEffectService.closeActiveEffectsForDisabledStrategy(
                    existing.getId(),
                    disableCleanupResult == null ? EFFECT_CLOSE_REASON_DISABLED : disableCleanupResult.effectCloseReason(),
                    disableCleanupResult == null ? SOURCE_TYPE_STRATEGY_DISABLE : disableCleanupResult.effectCloseSourceType(),
                    disableCleanupResult == null ? null : disableCleanupResult.commandLogId()
            );
        } catch (Exception ex) {
            log.warn("[STRATEGY_UPDATE] shadow effect close skipped traceId={} strategyId={} reason={}",
                    traceId, existing.getId(), safeMessage(ex));
        }
    }

    private void recordStrategyStatusChangeLogIfNeeded(Strategy strategy,
                                                       String operationType,
                                                       String traceId,
                                                       DisableCleanupResult disableCleanupResult) {
        if (!OPERATION_ENABLE.equals(operationType) && !OPERATION_DISABLE.equals(operationType)) {
            return;
        }

        StrategyExecutionLog executionLog = new StrategyExecutionLog();
        executionLog.setStrategyId(strategy.getId());
        executionLog.setPlantId(strategy.getPlantId());
        executionLog.setTriggerSource(TRIGGER_SOURCE_STRATEGY_UPDATE);
        executionLog.setTriggerPayload(buildStrategyStatusChangePayload(strategy, operationType, traceId, disableCleanupResult));
        executionLog.setExecutionResult(resolveStatusChangeExecutionResult(operationType, disableCleanupResult));
        executionLog.setResultMessage(buildStrategyStatusChangeMessage(strategy, operationType, disableCleanupResult));
        executionLog.setCommandLogId(resolveStatusChangeCommandLogId(operationType, disableCleanupResult));
        executionLog.setExecutedAt(LocalDateTime.now());

        int inserted = strategyExecutionLogMapper.insert(executionLog);
        log.info("[STRATEGY_UPDATE] status log inserted traceId={} strategyId={} operationType={} inserted={} logId={} sourceMethod=StrategyServiceImpl.recordStrategyStatusChangeLogIfNeeded",
                traceId, strategy.getId(), operationType, inserted, executionLog.getId());
    }

    private String resolveStatusChangeExecutionResult(String operationType, DisableCleanupResult disableCleanupResult) {
        if (OPERATION_DISABLE.equals(operationType)
                && disableCleanupResult != null
                && CLEANUP_STATUS_FAILED.equals(disableCleanupResult.status())) {
            return EXECUTION_FAILED;
        }
        return EXECUTION_SUCCESS;
    }

    private Long resolveStatusChangeCommandLogId(String operationType, DisableCleanupResult disableCleanupResult) {
        if (!OPERATION_DISABLE.equals(operationType) || disableCleanupResult == null) {
            return null;
        }
        return disableCleanupResult.commandLogId();
    }

    private String buildStrategyStatusChangePayload(Strategy strategy,
                                                    String operationType,
                                                    String traceId,
                                                    DisableCleanupResult disableCleanupResult) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("traceId", traceId);
        payload.put("strategyId", strategy.getId());
        payload.put("strategyName", strategy.getStrategyName());
        payload.put("operationType", operationType);
        payload.put("enabled", strategy.getEnabled());
        if (OPERATION_DISABLE.equals(operationType) && disableCleanupResult != null) {
            payload.put("disableCleanupRequired", disableCleanupResult.required());
            payload.put("disableCleanupStatus", disableCleanupResult.status());
            payload.put("disableCleanupCommandLogId", disableCleanupResult.commandLogId());
            payload.put("disableCleanupMessage", disableCleanupResult.message());
            payload.put("disableCleanupEffectCloseReason", disableCleanupResult.effectCloseReason());
            payload.put("disableCleanupEffectCloseSourceType", disableCleanupResult.effectCloseSourceType());
            payload.put("disableCleanupMode", disableCleanupResult.cleanupMode());
            payload.put("disableCleanupEffectId", disableCleanupResult.effectId());
        }
        payload.put("sourceMethod", "StrategyServiceImpl.recordStrategyStatusChangeLogIfNeeded");
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            return payload.toString();
        }
    }

    private String buildStrategyStatusChangeMessage(Strategy strategy,
                                                    String operationType,
                                                    DisableCleanupResult disableCleanupResult) {
        if (OPERATION_DISABLE.equals(operationType)) {
            String baseMessage = "\u7b56\u7565\u5df2\u505c\u7528\uff1a" + strategy.getStrategyName();
            if (disableCleanupResult == null || !disableCleanupResult.required()) {
                return baseMessage;
            }
            return baseMessage + "; " + disableCleanupResult.message();
        }
        if (OPERATION_ENABLE.equals(operationType)) {
            return "\u7b56\u7565\u5df2\u542f\u7528\uff1a" + strategy.getStrategyName();
        }
        return "\u7b56\u7565\u5df2\u66f4\u65b0\uff1a" + strategy.getStrategyName();
    }

    private void recordStrategyStatusChangeLogIfNeeded(Strategy strategy, String operationType, String traceId) {
        if (!OPERATION_ENABLE.equals(operationType) && !OPERATION_DISABLE.equals(operationType)) {
            return;
        }

        StrategyExecutionLog executionLog = new StrategyExecutionLog();
        executionLog.setStrategyId(strategy.getId());
        executionLog.setPlantId(strategy.getPlantId());
        executionLog.setTriggerSource(TRIGGER_SOURCE_STRATEGY_UPDATE);
        executionLog.setTriggerPayload(buildStrategyStatusChangePayload(strategy, operationType, traceId));
        executionLog.setExecutionResult(EXECUTION_SUCCESS);
        executionLog.setResultMessage(buildStrategyStatusChangeMessage(strategy, operationType));
        executionLog.setExecutedAt(LocalDateTime.now());

        int inserted = strategyExecutionLogMapper.insert(executionLog);
        log.info("[STRATEGY_UPDATE] status log inserted traceId={} strategyId={} operationType={} inserted={} logId={} sourceMethod=StrategyServiceImpl.recordStrategyStatusChangeLogIfNeeded",
                traceId, strategy.getId(), operationType, inserted, executionLog.getId());
    }

    private String buildStrategyStatusChangePayload(Strategy strategy, String operationType, String traceId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("traceId", traceId);
        payload.put("strategyId", strategy.getId());
        payload.put("strategyName", strategy.getStrategyName());
        payload.put("operationType", operationType);
        payload.put("enabled", strategy.getEnabled());
        payload.put("sourceMethod", "StrategyServiceImpl.recordStrategyStatusChangeLogIfNeeded");
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            return payload.toString();
        }
    }

    private String buildStrategyStatusChangeMessage(Strategy strategy, String operationType) {
        if (OPERATION_DISABLE.equals(operationType)) {
            return "策略已停用：" + strategy.getStrategyName();
        }
        if (OPERATION_ENABLE.equals(operationType)) {
            return "策略已启用：" + strategy.getStrategyName();
        }
        return "策略已更新：" + strategy.getStrategyName();
    }

    private void recordStrategyEffectIfNeeded(Strategy strategy,
                                              Long deviceId,
                                              String controlTarget,
                                              String beforeState,
                                              String appliedState,
                                              Long commandLogId) {
        if (!isDeviceControlAction(strategy) || deviceId == null || commandLogId == null) {
            return;
        }
        try {
            strategyDeviceEffectService.recordStrategyEffect(
                    strategy.getId(),
                    strategy.getPlantId(),
                    deviceId,
                    controlTarget,
                    normalizeDeviceState(beforeState),
                    normalizeDeviceState(appliedState),
                    commandLogId
            );
        } catch (Exception ex) {
            log.warn("[STRATEGY_RT] shadow effect record skipped. strategyId={} deviceId={} commandLogId={} reason={}",
                    strategy.getId(), deviceId, commandLogId, safeMessage(ex));
        }
    }

    private String resolveCurrentDeviceStateForEffect(Strategy strategy, Long deviceId) {
        if (deviceId == null) {
            return null;
        }
        Device device = deviceMapper.selectById(deviceId);
        if (device == null) {
            return null;
        }
        return normalizeDeviceState(resolveCurrentDeviceActionState(device, strategy.getActionType()));
    }

    private String resolveCurrentDeviceStateForEffectTarget(Device device,
                                                            StrategyDeviceEffect effect,
                                                            Strategy strategy) {
        if (device == null) {
            return null;
        }
        String controlTarget = effect == null ? null : effect.getControlTarget();
        String currentState = resolveCurrentDeviceActionStateByControlTarget(device, controlTarget);
        if (StringUtils.hasText(currentState)) {
            return normalizeDeviceState(currentState);
        }
        return normalizeDeviceState(resolveCurrentDeviceActionState(device, strategy.getActionType()));
    }

    private String resolveControlTarget(String actionType) {
        if (ACTION_AUTO_LIGHT.equals(actionType)) {
            return CONTROL_TARGET_LIGHT;
        }
        if (ACTION_AUTO_FAN.equals(actionType)) {
            return CONTROL_TARGET_FAN;
        }
        return null;
    }

    private String resolveCurrentDeviceActionStateByControlTarget(Device device, String controlTarget) {
        if (device == null || !StringUtils.hasText(controlTarget)) {
            return null;
        }
        Map<String, Object> statusMap = parseStatusMap(device.getCurrentStatus());
        Object state = null;
        String normalizedTarget = controlTarget.trim().toUpperCase(Locale.ROOT);
        if (CONTROL_TARGET_LIGHT.equals(normalizedTarget)) {
            state = firstNonNull(statusMap, "lightStatus", "light_status", "light", "power", "status", "switch", "value");
        } else if (CONTROL_TARGET_FAN.equals(normalizedTarget)) {
            state = firstNonNull(statusMap, "fanStatus", "fan_status", "fan", "power", "status", "switch", "value");
        }
        if (state != null) {
            return String.valueOf(state);
        }
        if (statusMap.isEmpty() && StringUtils.hasText(device.getCurrentStatus())) {
            return device.getCurrentStatus();
        }
        return null;
    }

    private String resolveCurrentDeviceActionState(Device device, String actionType) {
        Map<String, Object> statusMap = parseStatusMap(device.getCurrentStatus());
        Object state = null;
        if (ACTION_AUTO_LIGHT.equals(actionType)) {
            state = firstNonNull(statusMap, "lightStatus", "light_status", "light", "power", "status", "switch", "value");
        } else if (ACTION_AUTO_FAN.equals(actionType)) {
            state = firstNonNull(statusMap, "fanStatus", "fan_status", "fan", "power", "status", "switch", "value");
        }
        if (state != null) {
            return String.valueOf(state);
        }
        if (statusMap.isEmpty() && StringUtils.hasText(device.getCurrentStatus())) {
            return device.getCurrentStatus();
        }
        return null;
    }

    private Map<String, Object> parseStatusMap(String json) {
        if (!StringUtils.hasText(json)) {
            return Collections.emptyMap();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (Exception ex) {
            return Collections.emptyMap();
        }
    }

    private Object firstNonNull(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            if (map.containsKey(key) && map.get(key) != null) {
                return map.get(key);
            }
        }
        return null;
    }

    private String normalizeDeviceState(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return switch (value.trim().toUpperCase(Locale.ROOT)) {
            case "OPEN", "RUNNING", "TRUE", "1", "LOW", "HIGH" -> "ON";
            case "CLOSE", "STOPPED", "FALSE", "0" -> "OFF";
            default -> value.trim().toUpperCase(Locale.ROOT);
        };
    }

    private Strategy buildStrategy(StrategyUpsertDTO request, Strategy existing) {
        Strategy strategy = new Strategy();
        strategy.setPlantId(request.getPlantId());
        strategy.setCreatedBy(resolveCreatedBy(request, existing));
        strategy.setStrategyName(request.getStrategyName());
        strategy.setStrategyType(request.getStrategyType());
        strategy.setTargetDeviceId(request.getTargetDeviceId());
        strategy.setMetricType(request.getMetricType());
        strategy.setOperatorType(request.getOperatorType());
        strategy.setThresholdMin(request.getThresholdMin());
        strategy.setThresholdMax(request.getThresholdMax());
        strategy.setActionType(request.getActionType());
        strategy.setActionValue(request.getActionValue());
        strategy.setCronExpr(request.getCronExpr());
        strategy.setEnabled(request.getEnabled() == null || request.getEnabled());
        strategy.setPriority(request.getPriority() == null ? 0 : request.getPriority());
        strategy.setConfigJson(buildConfigJson(request));
        return strategy;
    }

    private void validateStrategy(Strategy strategy, StrategyUpsertDTO request) {
        requirePlant(strategy.getPlantId());
        requireUser(strategy.getCreatedBy());
        validateStrategyType(strategy);
        validateAction(strategy);
        validateTrigger(strategy);
        validateConfig(request);
    }

    private void validateStrategyType(Strategy strategy) {
        if (!STRATEGY_TYPES.contains(strategy.getStrategyType())) {
            throw badRequest("strategyType 仅支持 CONDITION 或 SCHEDULE");
        }
        if (!ACTION_TYPES.contains(strategy.getActionType())) {
            throw badRequest("actionType 仅支持 AUTO_LIGHT、AUTO_FAN、NOTIFY_USER");
        }
    }

    private void validateAction(Strategy strategy) {
        if (!StringUtils.hasText(strategy.getActionValue())) {
            throw badRequest("actionValue 不能为空");
        }
        switch (strategy.getActionType()) {
            case ACTION_AUTO_LIGHT -> {
                if (!AUTO_LIGHT_VALUES.contains(strategy.getActionValue())) {
                    throw badRequest("AUTO_LIGHT 的 actionValue 仅支持 ON 或 OFF");
                }
                requireTargetDevice(strategy, true);
            }
            case ACTION_AUTO_FAN -> {
                if (!AUTO_FAN_VALUES.contains(strategy.getActionValue())) {
                    throw badRequest("AUTO_FAN actionValue only supports ON/OFF/LOW/HIGH");
                }
                requireTargetDevice(strategy, true);
            }
            case ACTION_NOTIFY_USER -> {
                if (!NOTIFY_VALUES.contains(strategy.getActionValue())) {
                    throw badRequest("NOTIFY_USER 的 actionValue 仅支持 INFO、WARNING、DANGER");
                }
                requireTargetDevice(strategy, false);
            }
            default -> throw badRequest("不支持的 actionType");
        }
    }

    private void validateTrigger(Strategy strategy) {
        if (TYPE_CONDITION.equals(strategy.getStrategyType())) {
            if (!CONDITION_METRICS.contains(strategy.getMetricType())) {
                throw badRequest("CONDITION 策略必须指定有效的 metricType");
            }
            if (!CONDITION_OPERATORS.contains(strategy.getOperatorType())) {
                throw badRequest("CONDITION 策略的 operatorType 仅支持 GT/GTE/LT/LTE/EQ/BETWEEN");
            }
            if (StringUtils.hasText(strategy.getCronExpr())) {
                throw badRequest("CONDITION 策略不能传 cronExpr");
            }
            switch (strategy.getOperatorType()) {
                case OPERATOR_GT, OPERATOR_GTE -> {
                    if (strategy.getThresholdMin() == null) {
                        throw badRequest(strategy.getOperatorType() + " operation requires thresholdMin");
                    }
                    if (strategy.getThresholdMax() != null) {
                        throw badRequest(strategy.getOperatorType() + " operation must not pass thresholdMax");
                    }
                }
                case OPERATOR_LT, OPERATOR_LTE -> {
                    if (upperThreshold(strategy) == null) {
                        throw badRequest(strategy.getOperatorType() + " operation requires thresholdMax");
                    }
                }
                case OPERATOR_EQ -> {
                    if (exactThreshold(strategy) == null) {
                        throw badRequest("EQ operation requires thresholdMin or thresholdMax");
                    }
                }
                case OPERATOR_BETWEEN -> {
                    if (strategy.getThresholdMin() == null || strategy.getThresholdMax() == null) {
                        throw badRequest("BETWEEN 操作必须同时提供 thresholdMin 和 thresholdMax");
                    }
                    if (strategy.getThresholdMin().compareTo(strategy.getThresholdMax()) > 0) {
                        throw badRequest("BETWEEN 操作要求 thresholdMin 小于等于 thresholdMax");
                    }
                }
                default -> throw badRequest("不支持的 operatorType");
            }
            return;
        }

        if (!OPERATOR_CRON.equals(strategy.getOperatorType())) {
            throw badRequest("SCHEDULE 策略的 operatorType 必须为 CRON");
        }
        if (!StringUtils.hasText(strategy.getCronExpr())) {
            throw badRequest("SCHEDULE 策略必须提供 cronExpr");
        }
        try {
            CronExpression.parse(strategy.getCronExpr());
        } catch (IllegalArgumentException ex) {
            throw badRequest("cronExpr 格式不合法");
        }
        strategy.setMetricType(METRIC_NONE);
        strategy.setThresholdMin(null);
        strategy.setThresholdMax(null);
    }

    private void validateConfig(StrategyUpsertDTO request) {
        if (!Boolean.TRUE.equals(getTimeLimitEnabled(request))) {
            return;
        }
        if (!StringUtils.hasText(getStartTime(request)) || !StringUtils.hasText(getEndTime(request))) {
            throw badRequest("启用时间范围限制时必须同时提供 startTime 和 endTime");
        }
        parseTime(getStartTime(request), "startTime");
        parseTime(getEndTime(request), "endTime");
    }

    private void validateConflict(Strategy strategy, Long excludeId) {
        if (!Boolean.TRUE.equals(strategy.getEnabled())) {
            return;
        }
        List<Strategy> candidates = strategyMapper.selectConflictCandidates(
                strategy.getPlantId(),
                strategy.getStrategyType(),
                strategy.getActionType(),
                strategy.getTargetDeviceId(),
                strategy.getMetricType(),
                strategy.getCronExpr(),
                excludeId
        );
        for (Strategy candidate : candidates) {
            // 当前阶段采用保守冲突检测：
            // 先比对时间范围是否重叠，再判断条件区间或 cron 是否重叠。
            if (isConflict(strategy, candidate)) {
                throw new BizException(ResultCode.CONFLICT.getCode(),
                        buildConflictMessage(strategy, candidate));
            }
        }
    }

    private boolean isConflict(Strategy current, Strategy existing) {
        if (!isTimeWindowConflict(current, existing)) {
            return false;
        }
        if (TYPE_SCHEDULE.equals(current.getStrategyType())) {
            return StringUtils.hasText(current.getCronExpr()) && current.getCronExpr().equals(existing.getCronExpr());
        }
        if (!current.getMetricType().equals(existing.getMetricType())) {
            return false;
        }
        return buildInterval(current).overlaps(buildInterval(existing));
    }

    private TriggerInterval buildInterval(Strategy strategy) {
        return switch (strategy.getOperatorType()) {
            case OPERATOR_GT -> new TriggerInterval(lowerThreshold(strategy), false, null, false);
            case OPERATOR_GTE -> new TriggerInterval(lowerThreshold(strategy), true, null, false);
            case OPERATOR_LT -> new TriggerInterval(null, false, upperThreshold(strategy), false);
            case OPERATOR_LTE -> new TriggerInterval(null, false, upperThreshold(strategy), true);
            case OPERATOR_EQ -> new TriggerInterval(exactThreshold(strategy), true, exactThreshold(strategy), true);
            case OPERATOR_BETWEEN -> new TriggerInterval(strategy.getThresholdMin(), true, strategy.getThresholdMax(), true);
            default -> throw badRequest("不支持的 operatorType");
        };
    }

    private boolean isTimeWindowConflict(Strategy current, Strategy existing) {
        TimeWindow currentWindow = extractTimeWindow(current);
        TimeWindow existingWindow = extractTimeWindow(existing);
        return currentWindow.overlaps(existingWindow);
    }

    private String buildConflictMessage(Strategy current, Strategy existing) {
        StringBuilder message = new StringBuilder("当前策略与已启用策略冲突");
        message.append("，冲突策略ID=").append(existing.getId());
        if (StringUtils.hasText(existing.getStrategyName())) {
            message.append("，策略名称=").append(existing.getStrategyName());
        }

        List<String> conflictFields = describeConflictFields(current, existing);
        if (!conflictFields.isEmpty()) {
            message.append("，冲突字段=").append(String.join("、", conflictFields));
        }

        message.append("。");
        return message.toString();
    }

    private List<String> describeConflictFields(Strategy current, Strategy existing) {
        List<String> fields = new java.util.ArrayList<>();

        if (!ACTION_NOTIFY_USER.equals(current.getActionType())
                && current.getTargetDeviceId() != null
                && current.getTargetDeviceId().equals(existing.getTargetDeviceId())) {
            fields.add("targetDeviceId=" + current.getTargetDeviceId());
        }

        if (TYPE_SCHEDULE.equals(current.getStrategyType())) {
            fields.add("cronExpr=" + current.getCronExpr());
        } else {
            fields.add("metricType=" + current.getMetricType());
            fields.add("thresholdRange=" + formatTriggerRange(current));
        }

        TimeWindow currentWindow = extractTimeWindow(current);
        TimeWindow existingWindow = extractTimeWindow(existing);
        if (currentWindow.overlaps(existingWindow)) {
            fields.add("timeRange=" + formatTimeWindow(currentWindow) + " vs " + formatTimeWindow(existingWindow));
        }

        fields.add("actionType=" + current.getActionType());
        return fields;
    }

    private String formatTriggerRange(Strategy strategy) {
        return switch (strategy.getOperatorType()) {
            case OPERATOR_GT -> ">" + lowerThreshold(strategy);
            case OPERATOR_GTE -> ">=" + lowerThreshold(strategy);
            case OPERATOR_LT -> "<" + upperThreshold(strategy);
            case OPERATOR_LTE -> "<=" + upperThreshold(strategy);
            case OPERATOR_EQ -> "=" + exactThreshold(strategy);
            case OPERATOR_BETWEEN -> "[" + strategy.getThresholdMin() + ", " + strategy.getThresholdMax() + "]";
            default -> strategy.getOperatorType();
        };
    }

    private String formatTimeWindow(TimeWindow window) {
        if (window.fullDay()) {
            return "全天";
        }
        return formatMinute(window.startMinute()) + "-" + formatMinute(window.endMinute());
    }

    private String formatMinute(int minute) {
        int normalized = ((minute % (24 * 60)) + (24 * 60)) % (24 * 60);
        int hour = normalized / 60;
        int min = normalized % 60;
        return String.format("%02d:%02d", hour, min);
    }

    private TimeWindow extractTimeWindow(Strategy strategy) {
        Map<String, Object> config = parseConfig(strategy.getConfigJson());
        boolean enabled = Boolean.TRUE.equals(readBoolean(config.get("timeLimitEnabled")));
        if (!enabled) {
            return TimeWindow.allDay();
        }
        String startText = readString(config.get("startTime"));
        String endText = readString(config.get("endTime"));
        if (!StringUtils.hasText(startText) || !StringUtils.hasText(endText)) {
            return TimeWindow.allDay();
        }
        return TimeWindow.of(parseTime(startText, "startTime"), parseTime(endText, "endTime"));
    }

    private boolean isWithinActiveTimeWindow(Strategy strategy) {
        return extractTimeWindow(strategy).contains(LocalTime.now());
    }

    private String buildConfigJson(StrategyUpsertDTO request) {
        Map<String, Object> config = new LinkedHashMap<>();
        if (request.getConfigJson() != null) {
            config.putAll(request.getConfigJson());
        }
        Boolean timeLimitEnabled = getTimeLimitEnabled(request);
        if (timeLimitEnabled != null) {
            config.put("timeLimitEnabled", timeLimitEnabled);
        }
        String startTime = getStartTime(request);
        if (StringUtils.hasText(startTime)) {
            config.put("startTime", startTime);
        }
        String endTime = getEndTime(request);
        if (StringUtils.hasText(endTime)) {
            config.put("endTime", endTime);
        }
        String notifyTitleTemplate = getNotifyTitleTemplate(request);
        if (StringUtils.hasText(notifyTitleTemplate)) {
            config.put("notifyTitleTemplate", notifyTitleTemplate);
        }
        String notifyContentTemplate = getNotifyContentTemplate(request);
        if (StringUtils.hasText(notifyContentTemplate)) {
            config.put("notifyContentTemplate", notifyContentTemplate);
        }
        if (config.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(config);
        } catch (JsonProcessingException ex) {
            throw badRequest("configJson 序列化失败");
        }
    }

    private Map<String, Object> parseConfig(String configJson) {
        if (!StringUtils.hasText(configJson)) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(configJson, new TypeReference<Map<String, Object>>() {
            });
        } catch (JsonProcessingException ex) {
            throw new BizException(ResultCode.SYSTEM_ERROR.getCode(), "策略配置解析失败");
        }
    }

    private Boolean getTimeLimitEnabled(StrategyUpsertDTO request) {
        if (request.getTimeLimitEnabled() != null) {
            return request.getTimeLimitEnabled();
        }
        return readBoolean(getConfigValue(request, "timeLimitEnabled"));
    }

    private String getStartTime(StrategyUpsertDTO request) {
        if (StringUtils.hasText(request.getStartTime())) {
            return request.getStartTime();
        }
        return readString(getConfigValue(request, "startTime"));
    }

    private String getEndTime(StrategyUpsertDTO request) {
        if (StringUtils.hasText(request.getEndTime())) {
            return request.getEndTime();
        }
        return readString(getConfigValue(request, "endTime"));
    }

    private String getNotifyTitleTemplate(StrategyUpsertDTO request) {
        if (StringUtils.hasText(request.getNotifyTitleTemplate())) {
            return request.getNotifyTitleTemplate();
        }
        return readString(getConfigValue(request, "notifyTitleTemplate"));
    }

    private String getNotifyContentTemplate(StrategyUpsertDTO request) {
        if (StringUtils.hasText(request.getNotifyContentTemplate())) {
            return request.getNotifyContentTemplate();
        }
        return readString(getConfigValue(request, "notifyContentTemplate"));
    }

    private Object getConfigValue(StrategyUpsertDTO request, String key) {
        Map<String, Object> config = request.getConfigJson();
        if (config == null) {
            return null;
        }
        return config.get(key);
    }

    private StrategyVO toStrategyVO(Strategy strategy) {
        Map<String, Object> config = parseConfig(strategy.getConfigJson());
        return StrategyVO.builder()
                .id(strategy.getId())
                .plantId(strategy.getPlantId())
                .createdBy(strategy.getCreatedBy())
                .strategyName(strategy.getStrategyName())
                .strategyType(strategy.getStrategyType())
                .targetDeviceId(strategy.getTargetDeviceId())
                .metricType(strategy.getMetricType())
                .operatorType(strategy.getOperatorType())
                .thresholdMin(strategy.getThresholdMin())
                .thresholdMax(strategy.getThresholdMax())
                .actionType(strategy.getActionType())
                .actionValue(strategy.getActionValue())
                .cronExpr(strategy.getCronExpr())
                .enabled(strategy.getEnabled())
                .priority(strategy.getPriority())
                .configJson(strategy.getConfigJson())
                .config(config)
                .timeLimitEnabled(readBoolean(config.get("timeLimitEnabled")))
                .startTime(readString(config.get("startTime")))
                .endTime(readString(config.get("endTime")))
                .notifyTitleTemplate(readString(config.get("notifyTitleTemplate")))
                .notifyContentTemplate(readString(config.get("notifyContentTemplate")))
                .createdAt(strategy.getCreatedAt())
                .updatedAt(strategy.getUpdatedAt())
                .build();
    }

    private StrategyExecutionLogVO toStrategyExecutionLogVO(StrategyExecutionLog log) {
        return StrategyExecutionLogVO.builder()
                .id(log.getId())
                .strategyId(log.getStrategyId())
                .plantId(log.getPlantId())
                .triggerSource(log.getTriggerSource())
                .triggerMetricValue(log.getTriggerMetricValue())
                .triggerPayload(log.getTriggerPayload())
                .executionResult(log.getExecutionResult())
                .resultMessage(log.getResultMessage())
                .commandLogId(log.getCommandLogId())
                .executedAt(log.getExecutedAt())
                .build();
    }

    private Strategy requireStrategy(Long strategyId) {
        Strategy strategy = strategyMapper.selectById(strategyId);
        if (strategy == null) {
            throw new BizException(ResultCode.NOT_FOUND.getCode(), "策略不存在");
        }
        return strategy;
    }

    private Plant requirePlant(Long plantId) {
        Plant plant = plantMapper.selectById(plantId);
        if (plant == null) {
            throw badRequest("plantId 对应的植物不存在");
        }
        return plant;
    }

    private User requireUser(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw badRequest("createdBy 对应的用户不存在");
        }
        return user;
    }

    private void requireTargetDevice(Strategy strategy, boolean required) {
        if (required && strategy.getTargetDeviceId() == null) {
            throw badRequest(strategy.getActionType() + " 策略必须指定 targetDeviceId");
        }
        if (strategy.getTargetDeviceId() == null) {
            return;
        }
        Device device = deviceMapper.selectById(strategy.getTargetDeviceId());
        if (device == null) {
            throw badRequest("targetDeviceId 对应的设备不存在");
        }
        if (!strategy.getPlantId().equals(device.getPlantId())) {
            throw badRequest("targetDeviceId 不属于当前 plantId");
        }
    }

    private record DisableCleanupResult(boolean required,
                                        String status,
                                        Long commandLogId,
                                        String message,
                                        String effectCloseReason,
                                        String effectCloseSourceType,
                                        String cleanupMode,
                                        Long effectId) {

        private static DisableCleanupResult notRequired(String effectCloseReason, String effectCloseSourceType) {
            return new DisableCleanupResult(false, CLEANUP_STATUS_NOT_REQUIRED, null, null, effectCloseReason, effectCloseSourceType, CLEANUP_MODE_NONE, null);
        }

        private static DisableCleanupResult skipped(String message,
                                                    String effectCloseReason,
                                                    String effectCloseSourceType) {
            return new DisableCleanupResult(true, CLEANUP_STATUS_SKIPPED, null, message, effectCloseReason, effectCloseSourceType, CLEANUP_MODE_LEGACY_FALLBACK, null);
        }

        private static DisableCleanupResult success(Long commandLogId,
                                                    String message,
                                                    String effectCloseReason,
                                                    String effectCloseSourceType) {
            return new DisableCleanupResult(true, CLEANUP_STATUS_SUCCESS, commandLogId, message, effectCloseReason, effectCloseSourceType, CLEANUP_MODE_LEGACY_FALLBACK, null);
        }

        private static DisableCleanupResult failed(Long commandLogId,
                                                   String message,
                                                   String effectCloseReason,
                                                   String effectCloseSourceType) {
            return new DisableCleanupResult(true, CLEANUP_STATUS_FAILED, commandLogId, message, effectCloseReason, effectCloseSourceType, CLEANUP_MODE_LEGACY_FALLBACK, null);
        }

        private static DisableCleanupResult rollbackSuccess(Long commandLogId,
                                                            String message,
                                                            Long effectId,
                                                            String effectCloseReason,
                                                            String effectCloseSourceType) {
            return new DisableCleanupResult(true, CLEANUP_STATUS_SUCCESS, commandLogId, message, effectCloseReason, effectCloseSourceType, CLEANUP_MODE_ROLLBACK, effectId);
        }

        private static DisableCleanupResult rollbackFailed(Long commandLogId,
                                                           String message,
                                                           Long effectId,
                                                           String effectCloseReason,
                                                           String effectCloseSourceType) {
            return new DisableCleanupResult(true, CLEANUP_STATUS_FAILED, commandLogId, message, effectCloseReason, effectCloseSourceType, CLEANUP_MODE_ROLLBACK, effectId);
        }
    }

    private Long resolveCreatedBy(StrategyUpsertDTO request, Strategy existing) {
        if (request.getCreatedBy() != null) {
            return request.getCreatedBy();
        }
        if (existing != null) {
            return existing.getCreatedBy();
        }
        throw badRequest("createdBy 不能为空，当前未接入登录上下文时请由前端显式传入");
    }

    private LocalTime parseTime(String value, String fieldName) {
        try {
            return LocalTime.parse(value);
        } catch (DateTimeParseException ex) {
            throw badRequest(fieldName + " 必须是 HH:mm 或 HH:mm:ss 格式");
        }
    }

    private Boolean readBoolean(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Boolean booleanValue) {
            return booleanValue;
        }
        return Boolean.valueOf(String.valueOf(value));
    }

    private String readString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private BizException badRequest(String message) {
        return new BizException(ResultCode.BAD_REQUEST.getCode(), message);
    }

    private record TriggerInterval(BigDecimal lower, boolean lowerInclusive,
                                   BigDecimal upper, boolean upperInclusive) {

        private boolean overlaps(TriggerInterval other) {
            if (upper != null && other.lower != null) {
                int compare = upper.compareTo(other.lower);
                if (compare < 0 || (compare == 0 && (!upperInclusive || !other.lowerInclusive))) {
                    return false;
                }
            }
            if (other.upper != null && lower != null) {
                int compare = other.upper.compareTo(lower);
                if (compare < 0 || (compare == 0 && (!other.upperInclusive || !lowerInclusive))) {
                    return false;
                }
            }
            return true;
        }
    }

    private record TimeWindow(int startMinute, int endMinute, boolean fullDay) {

        private static TimeWindow allDay() {
            return new TimeWindow(0, 24 * 60, true);
        }

        private static TimeWindow of(LocalTime start, LocalTime end) {
            int startMinute = start.getHour() * 60 + start.getMinute();
            int endMinute = end.getHour() * 60 + end.getMinute();
            if (start.equals(end)) {
                return allDay();
            }
            return new TimeWindow(startMinute, endMinute, false);
        }

        private boolean overlaps(TimeWindow other) {
            if (fullDay || other.fullDay) {
                return true;
            }
            return overlapsWithin48Hours(startMinute, endMinute, other.startMinute, other.endMinute);
        }

        private boolean contains(LocalTime time) {
            if (fullDay) {
                return true;
            }
            int minute = time.getHour() * 60 + time.getMinute();
            if (startMinute < endMinute) {
                return minute >= startMinute && minute <= endMinute;
            }
            return minute >= startMinute || minute <= endMinute;
        }

        private boolean overlapsWithin48Hours(int startA, int endA, int startB, int endB) {
            List<int[]> rangesA = expand(startA, endA);
            List<int[]> rangesB = expand(startB, endB);
            for (int[] rangeA : rangesA) {
                for (int[] rangeB : rangesB) {
                    if (rangeA[0] < rangeB[1] && rangeB[0] < rangeA[1]) {
                        return true;
                    }
                }
            }
            return false;
        }

        private List<int[]> expand(int start, int end) {
            if (start < end) {
                return List.of(
                        new int[]{start, end},
                        new int[]{start + 24 * 60, end + 24 * 60}
                );
            }
            return List.of(
                    new int[]{start, end + 24 * 60},
                    new int[]{start - 24 * 60, end}
            );
        }
    }
}
