package com.plantcloud.plant.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plantcloud.config.DeepSeekProperties;
import com.plantcloud.plant.service.PlantAiExplanationService;
import com.plantcloud.plant.vo.AiExplanationVO;
import com.plantcloud.plant.vo.PlantPredictionAiVO;
import com.plantcloud.plant.vo.RiskAnalysisResultVO;
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
import java.util.function.Predicate;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
public class PlantAiExplanationServiceImpl implements PlantAiExplanationService {

    private static final String DEFAULT_SUMMARY = "当前环境存在异常，请注意植物状态变化。";
    private static final String DEFAULT_ADVICE = "建议适当调整环境条件，如温度、湿度或光照。";
    private static final String DEFAULT_WARNING = "请及时关注植物健康状态。";
    private static final String SYSTEM_PROMPT = "你是一个面向普通用户的植物养护助手。";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final DeepSeekProperties deepSeekProperties;

    @Override
    public AiExplanationVO generateExplanation(RiskAnalysisResultVO result) {
        return requestExplanation(
                buildRequestBody(result),
                AiExplanationVO.class,
                explanation -> StringUtils.hasText(explanation.getSummary())
                        && StringUtils.hasText(explanation.getAdvice())
                        && StringUtils.hasText(explanation.getWarning()),
                this::defaultExplanation
        );
    }

    @Override
    public PlantPredictionAiVO generatePredictionExplanation(String prompt) {
        return requestExplanation(
                buildPromptOnlyRequestBody(prompt),
                PlantPredictionAiVO.class,
                explanation -> StringUtils.hasText(explanation.getSummary())
                        && explanation.getAdvice() != null
                        && !explanation.getAdvice().isEmpty()
                        && explanation.getRiskWarnings() != null
                        && !explanation.getRiskWarnings().isEmpty(),
                this::defaultPredictionExplanation
        );
    }

    private <T> T requestExplanation(Map<String, Object> requestBody,
                                     Class<T> responseType,
                                     Predicate<T> validator,
                                     Supplier<T> defaultSupplier) {
        if (!StringUtils.hasText(deepSeekProperties.getApiKey())) {
            return defaultSupplier.get();
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(deepSeekProperties.getApiKey());

            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    buildRequestUrl(),
                    HttpMethod.POST,
                    requestEntity,
                    String.class
            );

            if (!response.getStatusCode().is2xxSuccessful() || !StringUtils.hasText(response.getBody())) {
                return defaultSupplier.get();
            }

            String content = extractContent(response.getBody());
            if (!StringUtils.hasText(content)) {
                return defaultSupplier.get();
            }

            T explanation = objectMapper.readValue(cleanJsonContent(content), responseType);
            if (!validator.test(explanation)) {
                return defaultSupplier.get();
            }
            return explanation;
        } catch (Exception ex) {
            return defaultSupplier.get();
        }
    }

    private Map<String, Object> buildRequestBody(RiskAnalysisResultVO result) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", deepSeekProperties.getModel());
        payload.put("messages", List.of(
                buildMessage("system", SYSTEM_PROMPT),
                buildMessage("user", buildUserPrompt(result))
        ));
        return payload;
    }

    private Map<String, Object> buildPromptOnlyRequestBody(String prompt) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", deepSeekProperties.getModel());
        payload.put("messages", List.of(buildMessage("user", prompt)));
        payload.put("response_format", Map.of("type", "json_object"));
        return payload;
    }

    private Map<String, String> buildMessage(String role, String content) {
        Map<String, String> message = new LinkedHashMap<>();
        message.put("role", role);
        message.put("content", content);
        return message;
    }

    private String buildUserPrompt(RiskAnalysisResultVO result) {
        String triggerReasons = result.getTriggerReasons() == null || result.getTriggerReasons().isEmpty()
                ? "- 无明显触发原因"
                : result.getTriggerReasons().stream()
                .map(reason -> "- " + reason)
                .reduce((left, right) -> left + "\n" + right)
                .orElse("- 无明显触发原因");

        return """
                你是“用户的专业智能植物管家”。
                你需要像一个有经验、会观察植物状态、也会照顾用户情绪的养护顾问一样说话。

                请根据以下植物环境风险分析结果，生成面向普通用户的解释与建议。

                输出必须是 JSON，格式如下：
                {
                "summary": "...",
                "advice": "...",
                "warning": "..."
                }

                不要输出解释说明。
                不要输出 markdown。
                只输出 JSON。

                【表达风格要求】
                1. 语气要自然、生动、有陪伴感，像植物管家在认真提醒用户，不要像系统播报或实验报告。
                2. 要结合具体数据说话，但不要机械罗列数据，要把数据自然融入句子里。
                3. 不要使用“阈值、模板、规则、超过上限”这类生硬词汇。
                4. 不要总是用“你的植物现在环境不太好”这种模板句开头，要尽量写得更像真人表达。
                5. 可以适当加入轻微的情绪感和提醒感，但不要夸张，不要吓人。
                6. 语言要让普通用户一看就懂，同时让人感觉专业、贴心、有判断依据。

                【各字段要求】
                1. summary：
                - 用 2 到 4 句话解释当前环境问题
                - 必须结合温度、湿度、光照和最近1小时变化
                - 要写出“环境正在往什么方向变化”以及“这对植物意味着什么”
                - 要像植物管家在观察后得出的判断，而不是像读检测报告

                2. advice：
                - 给出 2 到 4 条具体、立刻能做的建议
                - 每条建议尽量贴近日常生活场景，比如“移到哪里”“怎么处理光照”“怎么增加湿度”
                - 不要空泛，不要只有原则，要有动作感
                - 建议语气要温和、清晰，像在一步一步教用户处理

                3. warning：
                - 用 1 到 2 句话提醒如果继续放任不管，植物可能出现什么状态变化
                - 要具体到叶片、花苞、整体状态，不要泛泛地说“会影响生长”
                - 语气要有提醒感，但不要制造恐慌

                【额外要求】
                1. 不要编造输入中没有的数据。
                2. 不要输出“首先、其次、最后”这种太书面的表达。
                3. 不要把建议写成生硬编号说明书。
                4. 可以适当使用“这时候”“再这样下去”“先把它……”这类更自然的表达。
                5. 如果风险等级较高，请在语气上体现出“需要尽快处理”，但不要过度夸张。

                【输入数据】
                植物名称：%s
                风险等级：%s
                风险类型：%s
                当前温度：%s℃
                当前湿度：%s%%
                当前光照：%s lux
                最近1小时温度变化：%s℃
                最近1小时湿度变化：%s%%
                最近1小时光照变化：%s lux
                """.formatted(
                safeText(result.getPlantName()),
                safeText(result.getRiskLevel()),
                formatRiskTypes(result.getRiskType()),
                safeNumber(result.getTemperature()),
                safeNumber(result.getHumidity()),
                safeNumber(result.getLight()),
                safeNumber(result.getTempDelta()),
                safeNumber(result.getHumidityDelta()),
                safeNumber(result.getLightDelta()),
                triggerReasons
        );
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

    private String formatRiskTypes(List<String> riskTypes) {
        if (riskTypes == null || riskTypes.isEmpty()) {
            return "[]";
        }
        return riskTypes.toString();
    }

    private String safeText(String value) {
        return value == null ? "" : value;
    }

    private String safeNumber(Object value) {
        return value == null ? "0" : String.valueOf(value);
    }

    private AiExplanationVO defaultExplanation() {
        AiExplanationVO explanation = new AiExplanationVO();
        explanation.setSummary(DEFAULT_SUMMARY);
        explanation.setAdvice(DEFAULT_ADVICE);
        explanation.setWarning(DEFAULT_WARNING);
        return explanation;
    }

    private PlantPredictionAiVO defaultPredictionExplanation() {
        PlantPredictionAiVO explanation = new PlantPredictionAiVO();
        explanation.setSummary("当前环境需要再多留意一下，建议尽快帮植物把状态稳住。");
        explanation.setAdvice(List.of("先把植物移到更稳定的位置，避免温度和光照继续波动。", "接下来一两个小时多观察一次温湿度变化，及时做小幅调整。"));
        explanation.setRiskWarnings(List.of("如果这种状态继续维持，叶片和整体精神状态可能会慢慢变差。"));
        return explanation;
    }
}
