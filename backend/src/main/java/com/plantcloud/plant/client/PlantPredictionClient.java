package com.plantcloud.plant.client;

import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.plant.dto.PlantPredictionRequest;
import com.plantcloud.plant.dto.PlantPredictionResponse;
import com.plantcloud.system.exception.BizException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

@Component
@RequiredArgsConstructor
public class PlantPredictionClient {

    private static final String PREDICT_URL = "http://127.0.0.1:5000/predict";

    private final RestTemplate restTemplate;

    public PlantPredictionResponse.PlantPredictionResultDTO predict(PlantPredictionRequest request) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<PlantPredictionRequest> entity = new HttpEntity<>(request, headers);
            ResponseEntity<PlantPredictionResponse> response = restTemplate.exchange(
                    PREDICT_URL,
                    HttpMethod.POST,
                    entity,
                    PlantPredictionResponse.class
            );

            PlantPredictionResponse body = response.getBody();
            if (!response.getStatusCode().is2xxSuccessful()
                    || body == null
                    || !Boolean.TRUE.equals(body.getSuccess())
                    || body.getData() == null
                    || !StringUtils.hasText(body.getData().getStatus())
                    || !StringUtils.hasText(body.getData().getTrend())) {
                throw new BizException(ResultCode.SYSTEM_ERROR.getCode(), "预测模型服务调用失败");
            }
            return body.getData();
        } catch (BizException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BizException(ResultCode.SYSTEM_ERROR.getCode(), "预测模型服务调用失败");
        }
    }
}
