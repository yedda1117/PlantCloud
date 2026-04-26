package com.plantcloud.plant.client;

import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.plant.dto.PlantPredictionRequest;
import com.plantcloud.plant.dto.PlantPredictionResponse;
import com.plantcloud.system.exception.BizException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Component
@RequiredArgsConstructor
public class PlantPredictionClient {

    @Value("${plant.model-service.predict-url}")
    private String predictUrl;

    private final RestTemplate restTemplate;

    public PlantPredictionResponse.PlantPredictionResultDTO predict(PlantPredictionRequest request) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<PlantPredictionRequest> entity = new HttpEntity<>(request, headers);

            log.info("Calling plant-model-service predict endpoint: {}", predictUrl);
            ResponseEntity<PlantPredictionResponse> response = restTemplate.exchange(
                    predictUrl,
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
                log.warn("plant-model-service returned invalid response. predictUrl={}, httpStatus={}, body={}",
                        predictUrl, response.getStatusCode(), body);
                throw new BizException(ResultCode.SYSTEM_ERROR.getCode(), "Plant model service returned an invalid prediction result");
            }

            return body.getData();
        } catch (BizException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("plant-model-service call failed. predictUrl={}", predictUrl, ex);
            throw new BizException(ResultCode.SYSTEM_ERROR.getCode(), "Plant model service is unavailable, please check deployment logs");
        }
    }
}
