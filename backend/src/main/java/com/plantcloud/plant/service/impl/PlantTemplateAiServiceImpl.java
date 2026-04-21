package com.plantcloud.plant.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.config.DeepSeekProperties;
import com.plantcloud.plant.dto.PlantTemplateDataDTO;
import com.plantcloud.plant.service.PlantTemplateAiService;
import com.plantcloud.system.exception.BizException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlantTemplateAiServiceImpl implements PlantTemplateAiService {

    private static final String SYSTEM_PROMPT = """
            你是一个植物养护参数生成助手。你的任务是根据用户提供的植物名称，生成该植物适宜的环境参数模板，用于植物监测系统的初始化配置。

            你的职责仅限于：
            1. 根据植物名称，生成适宜的温度范围、湿度范围、光照范围
            2. 生成该植物对升温、降湿、强光的敏感度
            3. 输出养护难度和一句简要说明

            你不是植物医生，不负责疾病诊断，也不负责未来风险预测。
            你不能输出解释、分析过程、备注、markdown、代码块，只能输出一个合法 JSON 对象。

            你必须严格遵守以下输出要求：

            【输出格式要求】
            - 只能输出 JSON
            - 不要输出 ```json
            - 不要输出任何额外文字
            - JSON 必须可以被直接反序列化
            - 所有字段必须完整，不能缺失

            【固定输出字段】
            你必须返回以下字段：
            {
              "plantName": "字符串",
              "species": null,
              "tempMin": 数字,
              "tempMax": 数字,
              "humidityMin": 数字,
              "humidityMax": 数字,
              "lightMin": 数字,
              "lightMax": 数字,
              "tempRiseSensitive": 数字,
              "humidityDropSensitive": 数字,
              "lightRiseSensitive": 数字,
              "careLevel": "easy 或 medium 或 hard",
              "summary": "字符串"
            }

            【字段含义】
            - plantName: 植物名称，保持和用户输入一致
            - species: 第一版固定返回 null
            - tempMin/tempMax: 适宜温度范围，单位摄氏度
            - humidityMin/humidityMax: 适宜湿度范围，单位百分比
            - lightMin/lightMax: 适宜光照范围，单位 lux
            - tempRiseSensitive: 对升温敏感度，0~1
            - humidityDropSensitive: 对湿度下降敏感度，0~1
            - lightRiseSensitive: 对强光增强敏感度，0~1
            - careLevel: 只能是 easy、medium、hard 之一
            - summary: 一句简洁中文说明，不超过60字

            【硬性约束】
            1. tempMin < tempMax
            2. humidityMin < humidityMax
            3. lightMin < lightMax
            4. 0 <= tempMin,tempMax <= 45
            5. 0 <= humidityMin,humidityMax <= 100
            6. 0 <= lightMin,lightMax <= 100000
            7. 0 <= tempRiseSensitive <= 1
            8. 0 <= humidityDropSensitive <= 1
            9. 0 <= lightRiseSensitive <= 1
            10. careLevel 只能取 easy、medium、hard
            11. summary 必须是中文简述
            12. 所有数值请尽量符合常见植物养护常识，不要夸张，不要极端
            13. 如果你不确定某植物的精确习性，请给出保守、合理、偏中性的建议值，不要编造离谱参数

            【数值风格要求】
            - 温度、湿度、光照范围请给出“适宜区间”，不是生存极限
            - 敏感度推荐保留 1 位小数
            - 对湿度特别敏感的植物，humidityDropSensitive 可以更高
            - 对强光敏感的植物，lightRiseSensitive 可以更高
            - 对温度变化敏感的植物，tempRiseSensitive 可以更高

            【示例风格】
            用户输入“蝴蝶兰”时，可参考这种风格：
            {
              "plantName": "蝴蝶兰",
              "species": null,
              "tempMin": 18,
              "tempMax": 28,
              "humidityMin": 60,
              "humidityMax": 80,
              "lightMin": 2000,
              "lightMax": 8000,
              "tempRiseSensitive": 0.9,
              "humidityDropSensitive": 1.0,
              "lightRiseSensitive": 0.8,
              "careLevel": "hard",
              "summary": "蝴蝶兰喜欢温暖湿润、散射光环境，较怕干燥和强光。"
            }

            再次强调：只输出 JSON，不要输出任何解释。
            """;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final DeepSeekProperties deepSeekProperties;

    @Override
    public PlantTemplateDataDTO generateTemplate(String plantName) {
        if (!StringUtils.hasText(deepSeekProperties.getApiKey())) {
            throw new BizException(ResultCode.AI_PROCESS_FAILED.getCode(), "AI生成参数异常，请重新生成或手动填写");
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(deepSeekProperties.getApiKey());

            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(buildRequestBody(plantName), headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    buildRequestUrl(),
                    HttpMethod.POST,
                    requestEntity,
                    String.class
            );

            if (!response.getStatusCode().is2xxSuccessful() || !StringUtils.hasText(response.getBody())) {
                throw new BizException(ResultCode.AI_PROCESS_FAILED.getCode(), "AI生成参数异常，请重新生成或手动填写");
            }

            String content = extractContent(response.getBody());
            if (!StringUtils.hasText(content)) {
                throw new BizException(ResultCode.AI_PROCESS_FAILED.getCode(), "AI生成参数异常，请重新生成或手动填写");
            }

            PlantTemplateDataDTO templateData = objectMapper.readValue(cleanJsonContent(content), PlantTemplateDataDTO.class);
            templateData.setPlantName(plantName);
            return templateData;
        } catch (BizException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BizException(ResultCode.AI_PROCESS_FAILED.getCode(), "AI生成参数异常，请重新生成或手动填写");
        }
    }

    private Map<String, Object> buildRequestBody(String plantName) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", deepSeekProperties.getModel());
        payload.put("messages", List.of(
                buildMessage("system", SYSTEM_PROMPT),
                buildMessage("user", """
                        请为以下植物生成环境参数模板：

                        植物名称：%s
                        """.formatted(plantName))
        ));
        payload.put("temperature", 0.2);
        payload.put("response_format", Map.of("type", "json_object"));
        return payload;
    }

    private Map<String, String> buildMessage(String role, String content) {
        Map<String, String> message = new LinkedHashMap<>();
        message.put("role", role);
        message.put("content", content);
        return message;
    }

    private String buildRequestUrl() {
        String baseUrl = deepSeekProperties.getBaseUrl();
        if (baseUrl.endsWith("/")) {
            return baseUrl + "v1/chat/completions";
        }
        return baseUrl + "/v1/chat/completions";
    }

    private String extractContent(String responseBody) throws Exception {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
        if (contentNode.isMissingNode() || contentNode.isNull()) {
            return null;
        }
        return contentNode.asText();
    }

    private String cleanJsonContent(String content) {
        String trimmed = content.trim();
        if (trimmed.startsWith("```json")) {
            trimmed = trimmed.substring(7).trim();
        } else if (trimmed.startsWith("```")) {
            trimmed = trimmed.substring(3).trim();
        }
        if (trimmed.endsWith("```")) {
            trimmed = trimmed.substring(0, trimmed.length() - 3).trim();
        }
        return trimmed;
    }
}
