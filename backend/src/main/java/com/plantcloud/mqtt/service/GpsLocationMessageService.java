package com.plantcloud.mqtt.service;

import com.plantcloud.mqtt.listener.GpsLocationMessage;

public interface GpsLocationMessageService {

    void handleGpsLocation(Long deviceId, GpsLocationMessage message, String rawPayload);
}
