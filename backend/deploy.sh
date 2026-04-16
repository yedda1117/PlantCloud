#!/bin/bash

# ====== 配置区（改成你自己的）======
SERVER_USER=ubuntu
SERVER_IP=150.158.76.53
REMOTE_DIR=~/plantcloud
JAR_NAME=plantcloud-backend-0.0.1-SNAPSHOT.jar

# ====== 开始部署 ======

echo "🚀 开始打包..."
mvn clean package -DskipTests

if [ $? -ne 0 ]; then
  echo "❌ 打包失败"
  exit 1
fi

echo "📦 上传 jar 到服务器..."
scp target/$JAR_NAME $SERVER_USER@$SERVER_IP:$REMOTE_DIR/

echo "🔄 连接服务器并重启服务..."

ssh $SERVER_USER@$SERVER_IP << EOF

cd $REMOTE_DIR

echo "🛑 停止旧服务..."
pkill -f $JAR_NAME

echo "🗑 删除旧日志..."
rm -f logs/out.log

echo "🚀 启动新服务..."
nohup java -jar $JAR_NAME --spring.profiles.active=prod > logs/out.log 2>&1 &

echo "📊 查看启动日志..."
sleep 2
tail -n 20 logs/out.log

EOF

echo "✅ 部署完成！"