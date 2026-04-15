package com.plantcloud.mqtt.service;

import com.plantcloud.mqtt.listener.SmokeGasAlertMessage;

public interface SmokeGasAlertMessageService {

    void handleSmokeGasAlert(String topicDeviceToken, SmokeGasAlertMessage message, String rawPayload);
}
