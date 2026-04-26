package com.plantcloud.strategy.service;

import com.plantcloud.strategy.entity.StrategyDeviceEffect;

import java.util.Optional;

public interface StrategyDeviceEffectService {

    void recordStrategyEffect(Long strategyId,
                              Long plantId,
                              Long deviceId,
                              String controlTarget,
                              String beforeState,
                              String appliedState,
                              Long applyCommandLogId);

    void supersedeActiveEffectsByCommand(Long deviceId,
                                         String controlTarget,
                                         String sourceType,
                                         Long commandLogId);

    Optional<StrategyDeviceEffect> findLatestActiveEffectForStrategy(Long strategyId);

    void closeActiveEffectsForDisabledStrategy(Long strategyId,
                                               String closeReason,
                                               String sourceType,
                                               Long commandLogId);
}
