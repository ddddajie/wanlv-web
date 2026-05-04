# 景区预约运营看板聚合接口

本文档描述前端 `预约运营看板` 需要的后端聚合接口。项目统一响应结构保持现有约定：

```json
{
  "code": 200,
  "msg": "success",
  "data": {}
}
```

## 1. 查询预约运营看板

### 接口

`GET /reservation/admin/dashboard`

### 权限

仅管理员、超级管理员可访问。普通用户访问应返回无权限。

### Query 参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| scenicAreaId | number | 否 | 景区 ID，不传表示全部景区汇总 |
| date | string | 否 | 统计日期，格式 `YYYY-MM-DD`，不传默认当天 |

### 统计口径

- `orderCount`：统计日内创建的预约订单数量。
- `visitorCount`：统计日内预约订单的游客人数合计。
- `capacityUsageRate`：`已预约人数 / 总容量 * 100`，建议保留 1 位小数。
- `cancelRate`：`取消订单数 / 订单总数 * 100`，建议保留 1 位小数。
- `sourceDistribution.rate`：不同来源订单占比，来源值沿用 `FRONTEND`、`AGENT`、`ADMIN`。
- `heatSpots.x/y`：前端临时热力图坐标，百分比值 `0-100`。如果后端能从地图点位换算更好；否则可先返回固定布局坐标。
- `level`：容量紧张程度，建议规则：`usageRate >= 90` 为 `danger`，`usageRate >= 80` 为 `warning`，其他为 `normal`。

### 响应 data 示例

```json
{
  "scenicAreas": [
    { "id": 1, "name": "万旅山水景区" },
    { "id": 2, "name": "花溪湖景区" }
  ],
  "summary": {
    "orderCount": 1286,
    "orderCompareText": "较昨日 +12.8%",
    "visitorCount": 3842,
    "visitorHint": "峰值接近午后",
    "capacityUsageRate": 76,
    "capacityHint": "3 个景点偏紧",
    "cancelRate": 6.4,
    "cancelHint": "高于近 7 日均值"
  },
  "capacityRanks": [
    { "spotId": 101, "spotName": "云顶观景台", "usageRate": 93 },
    { "spotId": 102, "spotName": "水岸栈道", "usageRate": 84 }
  ],
  "sourceDistribution": [
    { "sourceType": "FRONTEND", "sourceName": "前台", "rate": 62 },
    { "sourceType": "AGENT", "sourceName": "Agent", "rate": 24 },
    { "sourceType": "ADMIN", "sourceName": "后台", "rate": 14 }
  ],
  "heatSpots": [
    {
      "spotId": 101,
      "spotName": "云顶观景台",
      "x": 58,
      "y": 28,
      "level": "danger",
      "totalCapacity": 480,
      "reservedCount": 446,
      "remainingCount": 34,
      "usageRate": 93
    }
  ],
  "trend": [
    { "label": "04-28", "orderCount": 890, "visitorCount": 2100 },
    { "label": "04-29", "orderCount": 960, "visitorCount": 2360 },
    { "label": "05-04", "orderCount": 1400, "visitorCount": 3740 }
  ],
  "statusDistribution": [
    { "status": "CONFIRMED", "statusName": "已预约", "rate": 52, "color": "#21c9aa" },
    { "status": "PENDING", "statusName": "待确认", "rate": 16, "color": "#f8b84e" },
    { "status": "COMPLETED", "statusName": "已完成", "rate": 16, "color": "#50d5ff" },
    { "status": "CANCELLED", "statusName": "已取消", "rate": 16, "color": "#ff6678" }
  ],
  "peakTimes": [
    {
      "timeRange": "10:00-11:00",
      "visitorCount": 968,
      "note": "云顶观景台、水岸栈道集中到达",
      "level": "danger"
    }
  ],
  "hotSpotRanks": [
    {
      "spotId": 101,
      "spotName": "云顶观景台",
      "orderCount": 446,
      "usageRate": 93,
      "remainingCount": 34,
      "level": "danger",
      "note": "容量利用率 93%，剩余 34"
    }
  ],
  "warnings": [
    {
      "title": "云顶观景台 10:00",
      "level": "danger",
      "tag": "快满",
      "description": "剩余 8 个名额，建议暂停推荐或追加临时容量。"
    }
  ],
  "liveActivities": [
    {
      "title": "王** 预约云顶观景台",
      "timeText": "刚刚",
      "description": "2 人，来源：前台，10:00-11:00"
    }
  ]
}
```

## 2. 字段说明

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| scenicAreas | array | 景区筛选下拉数据 |
| summary | object | 顶部核心指标 |
| capacityRanks | array | 左侧容量利用率排行，建议取前 4-6 条 |
| sourceDistribution | array | 来源占比 |
| heatSpots | array | 中间热力态势点位 |
| trend | array | 近 7 日趋势，按日期升序 |
| statusDistribution | array | 订单状态占比 |
| peakTimes | array | 高峰时段，建议取前 2-4 条 |
| hotSpotRanks | array | 热门景点排行，建议取前 5 条 |
| warnings | array | 容量、取消率等预警 |
| liveActivities | array | 最新预约、取消、后台/Agent 创建动态 |

## 3. 后端聚合建议

- 订单状态沿用现有预约状态：`PENDING`、`CONFIRMED`、`CANCELLED`、`COMPLETED`、`EXPIRED`。
- 预约来源沿用现有来源：`FRONTEND`、`AGENT`、`ADMIN`。
- 容量统计建议以 `reservation_slot` 为基础，按 `visitDate` 聚合 `totalCapacity`、`reservedCount`、`remainingCount`。
- 热门景点、容量排行、预警都可以复用同一份景点容量聚合结果，避免重复查询。
- 最新动态建议查询最近 10 条订单变更记录；如果当前没有审计表，可先取最近创建/取消的预约订单。
- 接口无需分页，前端只展示大屏必要数据，建议控制响应体在 50KB 以内。

