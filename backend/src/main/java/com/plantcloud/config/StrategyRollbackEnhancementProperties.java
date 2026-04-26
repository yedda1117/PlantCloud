package com.plantcloud.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "strategy.rollback-enhancement")
public class StrategyRollbackEnhancementProperties {

    /**
     * Enables rollback-to-before-state behavior during strategy disable.
     */
    private boolean enabled = false;

    /**
     * Enables shadow recording of strategy device effects.
     */
    private boolean shadowRecordingEnabled = true;
}
