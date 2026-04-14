package com.plantcloud.mqtt.service;

import com.plantcloud.mqtt.listener.TiltAlertMessage;

public interface TiltAlertMessageService {

    void handleTiltAlert(Long deviceId, TiltAlertMessage message, String rawPayload);
}
