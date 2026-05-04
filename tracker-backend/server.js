const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 内存存储轨迹（每个设备一个数组）
const trajectories = {};

// 创建 HTTP + WebSocket 服务器
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('网页客户端已连接');
  ws.send(JSON.stringify({ type: 'info', message: '已连接到服务器' }));
  ws.on('close', () => console.log('网页客户端断开'));
});

// 广播消息给所有网页客户端
function broadcast(data) {
  const text = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(text);
    }
  });
}

// 接收位置接口
app.post('/api/location', (req, res) => {
  const { lat, lng, timestamp, deviceId } = req.body;
  if (lat == null || lng == null || !deviceId) {
    return res.status(400).json({ error: '缺少必要字段' });
  }
  const point = { lat, lng, timestamp: timestamp || Date.now() };
  if (!trajectories[deviceId]) {
    trajectories[deviceId] = [];
  }
  trajectories[deviceId].push(point);

  // 实时推送给网页
  broadcast({ type: 'new_point', deviceId, point });
  console.log(`${deviceId}: (${lat}, ${lng})`);
  res.json({ success: true, count: trajectories[deviceId].length });
});

// 一键报警接口
app.post('/api/alert', (req, res) => {
  const { lat, lng, timestamp, deviceId } = req.body;
  if (lat == null || lng == null || !deviceId) {
    return res.status(400).json({ error: '缺少必要字段' });
  }
  const point = { lat, lng, timestamp: timestamp || Date.now() };
  if (!trajectories[deviceId]) {
    trajectories[deviceId] = [];
  }
  trajectories[deviceId].push(point);

  // 广播报警事件
  broadcast({ type: 'alert', deviceId, point });
  console.log(`🚨 SOS 报警 - ${deviceId}: (${lat}, ${lng})`);
  res.json({ success: true });
});

// 获取历史轨迹接口
app.get('/api/trajectory/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const points = trajectories[deviceId] || [];
  res.json({ deviceId, points });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器已启动，端口 ${PORT}`);
});
