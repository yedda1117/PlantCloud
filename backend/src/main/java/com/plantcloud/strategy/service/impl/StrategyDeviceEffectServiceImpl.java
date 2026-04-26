package com.plantcloud.strategy.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.plantcloud.config.StrategyRollbackEnhancementProperties;
import com.plantcloud.strategy.entity.StrategyDeviceEffect;
import com.plantcloud.strategy.mapper.StrategyDeviceEffectMapper;
import com.plantcloud.strategy.service.StrategyDeviceEffectService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class StrategyDeviceEffectServiceImpl implements StrategyDeviceEffectService {

    private static final String CLOSE_REASON_SUPERSEDED = "SUPERSEDED";

    private final StrategyDeviceEffectMapper strategyDeviceEffectMapper;
    private final StrategyRollbackEnhancementProperties properties;

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void recordStrategyEffect(Long strategyId,
                                     Long plantId,
                                     Long deviceId,
                                     String controlTarget,
                                     String beforeState,
                                     String appliedState,
                                     Long applyCommandLogId) {
        if (!properties.isShadowRecordingEnabled()) {
            return;
        }
        if (strategyId == null || plantId == null || deviceId == null || applyCommandLogId == null) {
            return;
        }
        if (!StringUtils.hasText(controlTarget) || !StringUtils.hasText(appliedState)) {
            return;
        }
        if (StringUtils.hasText(beforeState) && beforeState.equalsIgnoreCase(appliedState)) {
            return;
        }

        closeActiveEffectsByTarget(deviceId, controlTarget, CLOSE_REASON_SUPERSEDED, "STRATEGY", applyCommandLogId);

        LocalDateTime now = LocalDateTime.now();
        StrategyDeviceEffect effect = new StrategyDeviceEffect();
        effect.setStrategyId(strategyId);
        effect.setPlantId(plantId);
        effect.setDeviceId(deviceId);
        effect.setControlTarget(controlTarget);
        effect.setBeforeState(beforeState);
        effect.setAppliedState(appliedState);
        effect.setApplyCommandLogId(applyCommandLogId);
        effect.setActive(true);
        effect.setClosedReason(null);
        effect.setClosedBySourceType(null);
        effect.setClosedByCommandLogId(null);
        effect.setClosedAt(null);
        effect.setCreatedAt(now);
        effect.setUpdatedAt(now);
        strategyDeviceEffectMapper.insert(effect);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void supersedeActiveEffectsByCommand(Long deviceId,
                                                String controlTarget,
                                                String sourceType,
                                                Long commandLogId) {
        if (!properties.isShadowRecordingEnabled()) {
            return;
        }
        if (deviceId == null || commandLogId == null || !StringUtils.hasText(controlTarget)) {
            return;
        }
        if (isStrategySourceType(sourceType)) {
            return;
        }
        closeActiveEffectsByTarget(deviceId, controlTarget, CLOSE_REASON_SUPERSEDED, normalizeSourceType(sourceType), commandLogId);
    }

    @Override
    public Optional<StrategyDeviceEffect> findLatestActiveEffectForStrategy(Long strategyId) {
        if (!properties.isEnabled() || strategyId == null) {
            return Optional.empty();
        }
        StrategyDeviceEffect effect = strategyDeviceEffectMapper.selectOne(
                new LambdaQueryWrapper<StrategyDeviceEffect>()
                        .eq(StrategyDeviceEffect::getStrategyId, strategyId)
                        .eq(StrategyDeviceEffect::getActive, true)
                        .orderByDesc(StrategyDeviceEffect::getId)
                        .last("limit 1")
        );
        return Optional.ofNullable(effect);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void closeActiveEffectsForDisabledStrategy(Long strategyId,
                                                      String closeReason,
                                                      String sourceType,
                                                      Long commandLogId) {
        if (!properties.isShadowRecordingEnabled() || strategyId == null) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        strategyDeviceEffectMapper.update(
                null,
                new LambdaUpdateWrapper<StrategyDeviceEffect>()
                        .eq(StrategyDeviceEffect::getStrategyId, strategyId)
                        .eq(StrategyDeviceEffect::getActive, true)
                        .set(StrategyDeviceEffect::getActive, false)
                        .set(StrategyDeviceEffect::getClosedReason, closeReason)
                        .set(StrategyDeviceEffect::getClosedBySourceType, normalizeSourceType(sourceType))
                        .set(StrategyDeviceEffect::getClosedByCommandLogId, commandLogId)
                        .set(StrategyDeviceEffect::getClosedAt, now)
                        .set(StrategyDeviceEffect::getUpdatedAt, now)
        );
    }

    private void closeActiveEffectsByTarget(Long deviceId,
                                            String controlTarget,
                                            String closeReason,
                                            String sourceType,
                                            Long commandLogId) {
        LocalDateTime now = LocalDateTime.now();
        strategyDeviceEffectMapper.update(
                null,
                new LambdaUpdateWrapper<StrategyDeviceEffect>()
                        .eq(StrategyDeviceEffect::getDeviceId, deviceId)
                        .eq(StrategyDeviceEffect::getControlTarget, controlTarget)
                        .eq(StrategyDeviceEffect::getActive, true)
                        .set(StrategyDeviceEffect::getActive, false)
                        .set(StrategyDeviceEffect::getClosedReason, closeReason)
                        .set(StrategyDeviceEffect::getClosedBySourceType, sourceType)
                        .set(StrategyDeviceEffect::getClosedByCommandLogId, commandLogId)
                        .set(StrategyDeviceEffect::getClosedAt, now)
                        .set(StrategyDeviceEffect::getUpdatedAt, now)
        );
    }

    private boolean isStrategySourceType(String sourceType) {
        String normalized = normalizeSourceType(sourceType);
        return normalized.startsWith("STRATEGY");
    }

    private String normalizeSourceType(String sourceType) {
        if (!StringUtils.hasText(sourceType)) {
            return "UNKNOWN";
        }
        return sourceType.trim().toUpperCase();
    }
}
