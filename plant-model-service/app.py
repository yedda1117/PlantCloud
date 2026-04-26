import os
import joblib
import pandas as pd
from flask import Flask, request, jsonify


app = Flask(__name__)

# =========================
# 1. 模型文件路径
# =========================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")

STATUS_MODEL_PATH = os.path.join(MODEL_DIR, "status_model.pkl")
TREND_MODEL_PATH = os.path.join(MODEL_DIR, "trend_model.pkl")
FEATURE_COLUMNS_PATH = os.path.join(MODEL_DIR, "feature_columns.pkl")
LABEL_META_PATH = os.path.join(MODEL_DIR, "label_meta.pkl")


# =========================
# 2. 加载模型
# =========================
status_model = None
trend_model = None
feature_columns = None
label_meta = None


def load_models():
    global status_model, trend_model, feature_columns, label_meta

    status_model = joblib.load(STATUS_MODEL_PATH)
    trend_model = joblib.load(TREND_MODEL_PATH)
    feature_columns = joblib.load(FEATURE_COLUMNS_PATH)

    if os.path.exists(LABEL_META_PATH):
        label_meta = joblib.load(LABEL_META_PATH)
    else:
        label_meta = {}

    print("模型加载完成")
    print(f"status_model: {STATUS_MODEL_PATH}")
    print(f"trend_model: {TREND_MODEL_PATH}")
    print(f"feature_columns: {FEATURE_COLUMNS_PATH}")


# =========================
# 3. 输入校验
# =========================
REQUIRED_FIELDS = [
    "plant_type",
    "temp",
    "humidity",
    "light",
    "temp_diff_1h",
    "humidity_diff_1h",
    "light_diff_1h",
    "abnormal_duration",
]


def validate_input(data: dict):
    if not isinstance(data, dict):
        return False, "请求体必须是 JSON 对象"

    for field in REQUIRED_FIELDS:
        if field not in data:
            return False, f"缺少字段: {field}"

    if data["plant_type"] not in ["phalaenopsis", "succulent", "gardenia"]:
        return False, "plant_type 只能是 phalaenopsis、succulent 或 gardenia"

    numeric_fields = [
        "temp",
        "humidity",
        "light",
        "temp_diff_1h",
        "humidity_diff_1h",
        "light_diff_1h",
        "abnormal_duration",
    ]

    for field in numeric_fields:
        try:
            float(data[field])
        except (ValueError, TypeError):
            return False, f"字段 {field} 必须是数字"

    return True, None


# =========================
# 4. 特征预处理
# =========================
def prepare_features(input_data: dict) -> pd.DataFrame:
    df = pd.DataFrame([input_data])

    # 与训练时保持一致：对 plant_type 做 one-hot 编码
    df_encoded = pd.get_dummies(df, columns=["plant_type"])

    # 补齐训练时存在但当前输入没有的列
    for col in feature_columns:
        if col not in df_encoded.columns:
            df_encoded[col] = 0

    # 严格按训练时的列顺序排列
    df_encoded = df_encoded[feature_columns]

    return df_encoded


# =========================
# 5. 路由
# =========================
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "success": True,
        "message": "plant-model-service is running"
    })


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        is_valid, error_message = validate_input(data)
        if not is_valid:
            return jsonify({
                "success": False,
                "message": error_message
            }), 400

        # 转成模型输入格式
        input_data = {
            "plant_type": data["plant_type"],
            "temp": float(data["temp"]),
            "humidity": float(data["humidity"]),
            "light": float(data["light"]),
            "temp_diff_1h": float(data["temp_diff_1h"]),
            "humidity_diff_1h": float(data["humidity_diff_1h"]),
            "light_diff_1h": float(data["light_diff_1h"]),
            "abnormal_duration": float(data["abnormal_duration"]),
        }

        X = prepare_features(input_data)

        status_pred = status_model.predict(X)[0]
        trend_pred = trend_model.predict(X)[0]

        return jsonify({
            "success": True,
            "data": {
                "status": status_pred,
                "trend": trend_pred
            }
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"预测失败: {str(e)}"
        }), 500


# =========================
# 6. 启动
# =========================
if __name__ == "__main__":
    load_models()
    app.run(host="0.0.0.0", port=5000, debug=True)
