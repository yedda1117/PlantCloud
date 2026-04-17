package com.plantcloud.strategy.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.device.entity.Device;
import com.plantcloud.device.mapper.DeviceMapper;
import com.plantcloud.plant.entity.Plant;
import com.plantcloud.plant.mapper.PlantMapper;
import com.plantcloud.strategy.dto.StrategyLogQueryDTO;
import com.plantcloud.strategy.dto.StrategyQueryDTO;
import com.plantcloud.strategy.dto.StrategyUpsertDTO;
import com.plantcloud.strategy.entity.Strategy;
import com.plantcloud.strategy.entity.StrategyExecutionLog;
import com.plantcloud.strategy.mapper.StrategyExecutionLogMapper;
import com.plantcloud.strategy.mapper.StrategyMapper;
import com.plantcloud.strategy.service.StrategyService;
import com.plantcloud.strategy.vo.PageResult;
import com.plantcloud.strategy.vo.StrategyExecutionLogVO;
import com.plantcloud.strategy.vo.StrategyVO;
import com.plantcloud.system.exception.BizException;
import com.plantcloud.user.entity.User;
import com.plantcloud.user.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

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
    private static final Set<String> AUTO_FAN_VALUES = Set.of("LOW", "HIGH");
    private static final Set<String> NOTIFY_VALUES = Set.of("INFO", "WARNING", "DANGER");

    private final StrategyMapper strategyMapper;
    private final StrategyExecutionLogMapper strategyExecutionLogMapper;
    private final PlantMapper plantMapper;
    private final UserMapper userMapper;
    private final DeviceMapper deviceMapper;
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
        return toStrategyVO(requireStrategy(strategy.getId()));
    }

    @Override
    @Transactional
    public StrategyVO updateStrategy(Long strategyId, StrategyUpsertDTO request) {
        Strategy existing = requireStrategy(strategyId);
        Strategy strategy = buildStrategy(request, existing);
        strategy.setId(strategyId);
        validateStrategy(strategy, request);
        validateConflict(strategy, strategyId);
        strategyMapper.updateById(strategy);
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
                    throw badRequest("AUTO_FAN 的 actionValue 仅支持 LOW 或 HIGH");
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
                case OPERATOR_GT, OPERATOR_GTE, OPERATOR_LT, OPERATOR_LTE, OPERATOR_EQ -> {
                    if (strategy.getThresholdMin() == null) {
                        throw badRequest(strategy.getOperatorType() + " 操作必须提供 thresholdMin");
                    }
                    if (strategy.getThresholdMax() != null) {
                        throw badRequest(strategy.getOperatorType() + " 操作不能传 thresholdMax");
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
            case OPERATOR_GT -> new TriggerInterval(strategy.getThresholdMin(), false, null, false);
            case OPERATOR_GTE -> new TriggerInterval(strategy.getThresholdMin(), true, null, false);
            case OPERATOR_LT -> new TriggerInterval(null, false, strategy.getThresholdMin(), false);
            case OPERATOR_LTE -> new TriggerInterval(null, false, strategy.getThresholdMin(), true);
            case OPERATOR_EQ -> new TriggerInterval(strategy.getThresholdMin(), true, strategy.getThresholdMin(), true);
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
            case OPERATOR_GT -> ">" + strategy.getThresholdMin();
            case OPERATOR_GTE -> ">=" + strategy.getThresholdMin();
            case OPERATOR_LT -> "<" + strategy.getThresholdMin();
            case OPERATOR_LTE -> "<=" + strategy.getThresholdMin();
            case OPERATOR_EQ -> "=" + strategy.getThresholdMin();
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

    private String buildConfigJson(StrategyUpsertDTO request) {
        Map<String, Object> config = new LinkedHashMap<>();
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
