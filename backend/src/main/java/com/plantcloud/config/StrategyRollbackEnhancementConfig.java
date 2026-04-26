package com.plantcloud.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(StrategyRollbackEnhancementProperties.class)
public class StrategyRollbackEnhancementConfig {
}
