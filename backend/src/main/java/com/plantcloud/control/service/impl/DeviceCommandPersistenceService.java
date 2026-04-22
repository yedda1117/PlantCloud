package com.plantcloud.control.service.impl;

import com.plantcloud.control.entity.DeviceCommandLog;
import com.plantcloud.control.enums.CommandStatus;
import com.plantcloud.control.mapper.DeviceCommandLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class DeviceCommandPersistenceService {

    private final DeviceCommandLogMapper logMapper;

    @Transactional(rollbackFor = Exception.class)
    public DeviceCommandLog createPendingLog(DeviceCommandLog commandLog) {
        logMapper.insert(commandLog);
        return commandLog;
    }

    @Transactional(rollbackFor = Exception.class)
    public void markSuccess(DeviceCommandLog commandLog) {
        commandLog.setExecuteStatus(CommandStatus.SUCCESS.name());
        commandLog.setExecutedAt(LocalDateTime.now());
        logMapper.updateById(commandLog);
    }

    @Transactional(rollbackFor = Exception.class)
    public void markFailed(DeviceCommandLog commandLog, String errorMessage) {
        commandLog.setExecuteStatus(CommandStatus.FAILED.name());
        commandLog.setErrorMessage(errorMessage);
        commandLog.setExecutedAt(LocalDateTime.now());
        logMapper.updateById(commandLog);
    }

    @Transactional(rollbackFor = Exception.class)
    public DeviceCommandLog createOfflineLog(DeviceCommandLog commandLog) {
        logMapper.insert(commandLog);
        return commandLog;
    }
}
