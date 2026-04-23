# PlantCloud Mobile Capacitor

这是 PlantCloud 的独立移动端迁移目录，使用 Vite + React + Capacitor。它不经过登录注册页，启动后先显示移动端介绍页，点击即可进入首页；当前实现包含：

- 首页介绍页
- 移动端首页
- 植物详情页
- AI 问答页

接口保持和当前项目一致：

- 后端业务接口直接请求 `VITE_BACKEND_BASE_URL`
- AI 问答继续请求网页端已有的 `/api/ragflow/chat` 代理，也就是 `VITE_WEB_API_BASE_URL`
- 本地仍会读取 `localStorage.plantcloud_token`，有 token 时自动带 `Authorization: Bearer ...`，没有 token 也会直接进入页面

## 1. 安装依赖

```bash
cd mobile-capacitor
npm install
```

## 2. 配置接口地址

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

电脑浏览器调试时可以用：

```env
VITE_BACKEND_BASE_URL=http://localhost:8080
VITE_WEB_API_BASE_URL=http://localhost:3000
VITE_DEFAULT_PLANT_ID=1
```

真机或 Android 模拟器运行时不要写 `localhost` 指向电脑服务。请改成电脑局域网 IP，例如：

```env
VITE_BACKEND_BASE_URL=http://192.168.1.20:8080
VITE_WEB_API_BASE_URL=http://192.168.1.20:3000
```

如果使用 Android 模拟器访问电脑本机，也可以尝试：

```env
VITE_BACKEND_BASE_URL=http://10.0.2.2:8080
VITE_WEB_API_BASE_URL=http://10.0.2.2:3000
```

## 3. 浏览器调试

先启动现有服务：

```bash
cd ../backend
# 按你的 Spring Boot 启动方式启动 8080
```

```bash
cd ../fronted
npm run dev
```

再启动移动端：

```bash
cd ../mobile-capacitor
npm run dev
```

默认访问：

```text
http://localhost:5174
```

## 4. 打包并同步到 Capacitor

```bash
npm run build
npx cap sync
```

首次添加 Android：

```bash
npx cap add android
npx cap open android
```

首次添加 iOS：

```bash
npx cap add ios
npx cap open ios
```

iOS 需要 macOS + Xcode。

## 5. 常见问题

AI 问答不可用：

- 确认 `fronted` 的 Next 服务正在运行
- 确认 `VITE_WEB_API_BASE_URL` 指向网页端服务地址
- 确认网页端服务里配置了 RAGFlow 相关环境变量

真机访问接口失败：

- 手机和电脑要在同一局域网
- 后端 CORS 需要允许移动端地址
- `.env.local` 里不要使用 `localhost`

改完 `.env.local` 后需要重新构建并同步：

```bash
npm run build
npx cap sync
```
