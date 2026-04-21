# 🌿 PlantCloud

<div align="center">

### 一套把温室、传感器、设备控制、数据可视化和 AI 种植建议连起来的智慧农业云平台

> PlantCloud 不只是一个“看数据”的面板。  
> 它更像一间会回应的数字温室：感知环境、记录状态、联动设备、沉淀数据，并在合适的时候给出智能建议。

<br>

![Java](https://img.shields.io/badge/Java-17-3F7D58?style=for-the-badge&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.5-5C9D6F?style=for-the-badge&logo=springboot&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-1F2937?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-2563EB?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![MyBatis Plus](https://img.shields.io/badge/MyBatis--Plus-3.5.7-C05621?style=for-the-badge)
![MQTT](https://img.shields.io/badge/MQTT-Enabled-7C3AED?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active%20Development-2F855A?style=for-the-badge)

</div>

---

## 📖 项目简介

**PlantCloud** 是一个面向智慧农业 / 智能植物照护场景的全栈平台，打通了：

- **硬件感知**：温度、湿度、光照、设备状态等环境数据持续上报  
- **后端服务**：对传感器数据、植物信息、设备控制、策略日志进行统一管理  
- **前端交互**：将复杂的状态与数据转化为清晰、直观、可操作的界面  
- **AI 能力**：结合植物上下文、知识库与历史数据，提供问答与策略建议  

一句话概括：

> **植物负责生长，我们负责把系统做得更稳定、更漂亮、更聪明。**

---

## ✨ 核心能力

### 🌡 环境监测
- 接入并展示温度、湿度、光照、设备状态等数据
- 提供实时环境总览与关键指标监控

### 🎛 设备控制
- 支持补光灯、风扇等设备的远程控制
- 支持设备状态同步与联动反馈

### 🪴 植物档案
- 植物列表管理
- 植物与设备绑定
- 风险分析与植物上下文信息管理

### 📊 数据可视化
- 历史曲线展示
- 日历式种植记录
- 监控总览、策略日志可视化

### 🤖 AI 植物助手
- 提供对话式植物问答
- 结合知识库与实时状态生成种植建议
- 支持策略分析与新增策略建议

### 🚨 智能告警
- 异常环境记录
- 设备事件追踪
- 告警日志统一管理

### 🖼 图片与识别
- 植物图片上传与管理
- 接入 **SmartJavaAI** 的视觉相关能力

### 🔐 安全登录
- JWT 鉴权
- 人脸注册
- 人脸登录

---

## 🏗 项目架构

```text
PlantCloud
├─ fronted/              # Next.js + React 前端应用
│  ├─ app/               # 页面、路由与 API bridge
│  ├─ lib/               # 前端请求封装与业务上下文
│  └─ components/        # UI 组件
├─ backend/              # Spring Boot 后端服务
│  ├─ auth/              # 登录、鉴权、人脸认证
│  ├─ monitoring/        # 环境监测
│  ├─ device/            # 设备状态与绑定
│  ├─ visualization/     # 可视化数据接口
│  ├─ strategy/          # 策略配置与日志
│  ├─ mqtt/              # 硬件消息接入
│  ├─ photo/             # 图片上传与管理
│  ├─ qa/                # 智能问答
│  └─ config/            # 安全、跨域、服务配置
├─ device/               # 硬件端代码与模块资料
└─ docs/                 # 接口文档、用户故事、MQTT 文档
```

---

## 🧰 技术栈

| 层级 | 技术 |
| --- | --- |
| **前端** | Next.js 16、React 19、TypeScript、Tailwind CSS、Radix UI、Recharts、Leaflet |
| **后端** | Java 17、Spring Boot 3.3、Spring Security、WebSocket、Quartz |
| **数据层** | MySQL、Redis、MyBatis-Plus |
| **物联网通信** | MQTT、Eclipse Paho |
| **AI 与媒体能力** | Ragflow API Bridge、SmartJavaAI、MinIO |
| **接口文档** | Springdoc OpenAPI / Swagger UI |

---

## 🚀 快速开始

### 1. 启动后端

```bash
cd backend
mvn spring-boot:run
```

默认服务地址：

```text
http://localhost:8080
```

Swagger UI：

```text
http://localhost:8080/swagger-ui.html
```

> 后端默认读取 `backend/src/main/resources/application.yml`，并启用 `dev` profile。  
> 数据库、Redis、MQTT、MinIO 等本地参数请根据 `application-dev.yml` 调整。

---

### 2. 启动前端

```bash
cd fronted
npm install
npm run dev
```

默认前端地址：

```text
http://localhost:3000
```

---

## 🖥 主要页面

| 页面 | 说明 |
| --- | --- |
| `/home` | 植物与设备总览 |
| `/dashboard` | 环境监测与可视化大屏 |
| `/calendar` | 日历式种植记录 |
| `/chat` | AI 植物管家对话页面 |
| `/settings` | 设备、策略与系统设置 |
| `/login` / `/register` | 登录、注册与身份入口 |

---

## 🔌 重点接口

| 模块 | 接口 |
| --- | --- |
| **认证** | `POST /auth/login`、`POST /auth/face-register`、`POST /auth/face-login` |
| **环境监测** | `GET /monitoring/environment/current`、`GET /monitoring/devices/status` |
| **设备模块** | `GET /devices/status`、`GET /devices/infrared`、`POST /devices/bind-plant` |
| **可视化模块** | `GET /visualization/history`、`GET /visualization/calendar`、`GET /visualization/strategy-logs` |
| **控制模块** | `POST /control/light`、`POST /control/fan` |
| **植物模块** | `GET /plants`、`POST /plants/{id}/analyze-risk` |
| **策略模块** | `GET /strategies`、`POST /strategies`、`PUT /strategies/{strategyId}` |
| **图片模块** | `POST /photos/upload`、`DELETE /photos/{date}` |
| **问答模块** | `POST /qa/ask`、`GET /qa/history` |

---

## 🌱 项目节奏

PlantCloud 的整体逻辑很清晰：

### 先连接真实世界
传感器、人体感应、设备状态、MQTT 消息是平台的根。

### 再把状态变成可理解的数据
历史曲线、日历视图、总览面板，让零散数据变成可观察、可分析的信息。

### 然后接入策略与 AI
阈值规则、策略日志、智能问答与建议，让系统从“展示”走向“理解”和“辅助决策”。

### 最后回到用户体验
登录、导航、植物档案、聊天和设置页，把这些能力收束成一个真正可用的产品。

---

## 📂 仓库说明

- `docs/接口文档.md`：接口说明与业务文档  
- `docs/用户故事.md`：产品场景与用户故事  
- `docs/mqtt接口文档`：硬件消息接入说明  
- `device/`：硬件模块资料与设备侧内容  

---

## 👥 Contributors

<div align="center">

<a href="https://github.com/yedda1117">
  <img src="https://github.com/yedda1117.png" width="80px;" alt="yedda1117"/>
</a>
<a href="https://github.com/civet0921">
  <img src="https://github.com/civet0921.png" width="80px;" alt="civet0921"/>
</a>
<a href="https://github.com/Cindy-1123">
  <img src="https://github.com/Cindy-1123.png" width="80px;" alt="Cindy-1123"/>
</a>
<a href="https://github.com/Sylvia-x5796">
  <img src="https://github.com/Sylvia-x5796.png" width="80px;" alt="Sylvia-x5796"/>
</a>
<a href="https://github.com/x1808843327-sys">
  <img src="https://github.com/x1808843327-sys.png" width="80px;" alt="x1808843327-sys"/>
</a>

<br><br>

<a href="https://github.com/yedda1117">yedda1117</a> ・
<a href="https://github.com/civet0921">civet0921</a> ・
<a href="https://github.com/Cindy-1123">Cindy-1123</a> ・
<a href="https://github.com/Sylvia-x5796">Sylvia-x5796</a> ・
<a href="https://github.com/x1808843327-sys">x1808843327-sys</a>

</div>

---

## 📈 贡献统计

2026 年 4 月 12 日至 2026 年 4 月 19 日，项目经历了一周高密度推进：前端、后端、硬件、AI、页面交互、数据接入并行开展。

| Rank | Contributor | Commits | Additions | Deletions |
| ---: | --- | ---: | ---: | ---: |
| 1 | `yedda1117` | 30 | 21,873 | 834 |
| 2 | `civet0921` | 13 | 36,904 | 18,227 |
| 3 | `Cindy-1123` | 12 | 10,094 | 3,581 |
| 4 | `Sylvia-x5796` | 4 | 2,079 | 610 |
| 5 | `x1808843327-sys` | 1 | 0 | 3,111 |

> 这一周的提交曲线很有 PlantCloud 的气质：  
> 有人铺基础，有人接设备，有人调页面，有人修接口，也有人把 AI 与植物上下文缝到一起。  
> 代码不是一夜长出来的，但它确实在这一周长得很快。

---

## 📌 当前状态

PlantCloud 当前处于 **持续开发中**，已经形成了较完整的原型闭环，覆盖：

- 硬件数据采集
- 后端服务管理
- 前端数据展示
- AI 植物问答
- 智能策略建议
- 用户交互页面

后续仍可继续完善：

- 标准化部署文档
- 环境变量模板
- 测试体系
- 监控与日志体系
- 开源许可证与协作规范

---

## 📜 License

本项目当前 **暂未声明开源许可证**。

如果后续要用于：

- 公开展示
- 开源协作
- 比赛答辩
- 课程提交
- 对外部署

建议补充：

- `LICENSE`
- 部署说明
- 环境变量模板（如 `.env.example`）

---

## 💚 项目愿景

PlantCloud 希望做的，不只是把传感器数据放上网页。

它更想把 **设备、数据、可视化界面、策略逻辑与 AI 能力** 串成一个完整系统，  
让植物照护这件事变得：

- **更可见**
- **更可管理**
- **更智能**

> 温室不该只是收集信号，  
> 它也应该能理解信号。
