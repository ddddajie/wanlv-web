# 万旅前端项目

`wanlv-web` 是万旅系统的前端工程，基于 Vue 3、Vite、Element Plus、Pinia、MapLibre GL 和 ECharts 构建。项目目前覆盖游客展示、普通用户预约、管理员运营管理、景区地图维护、智能问答/数字人、用户管理和日报分析等页面能力。

## 技术栈

- Vue 3 + Vite
- Vue Router
- Pinia + pinia-plugin-persistedstate
- Element Plus + @element-plus/icons-vue
- Axios
- MapLibre GL
- Turf / @turf/turf
- ECharts
- Sass

## 功能模块

- 登录与权限：普通用户登录、手机号验证码登录、管理员登录、超级管理员权限、游客模式访问控制。
- 数据大屏：管理员预约运营大屏、普通用户预约状态大屏，支持景区筛选、日期切换、容量热度与趋势展示。
- 景点预约：普通用户可查看可预约景点、选择日期时段、提交预约、查看和取消自己的预约订单。
- 预约管理：管理员可维护预约规则、批量生成预约时段、管理临时时段、查询订单并执行入园确认。
- 景区地图：景区、景点、路线、路线地理数据和地理要素管理，支持 MapLibre 地图交互。
- 导游地图：游客、普通用户和管理员都可以查看景区导览地图。
- 智能问答：普通用户可使用智能问答页面，支持 Agent 问答、会话分析和数字人相关服务。
- 用户管理：管理员详情、普通用户详情、管理员分页列表、普通用户分页列表；超级管理员可新增管理员。
- 个人中心：登录用户可修改个人信息，普通用户可维护实名信息。
- 日报管理：超级管理员可查看智能问答会话分析和日报相关页面。

## 目录结构

```text
wanlv-web
├─ public/                 # 静态资源
├─ docs/                   # 项目补充文档
├─ prototypes/             # 页面原型
├─ src/
│  ├─ api/                 # 后端接口封装
│  ├─ components/          # 通用组件
│  ├─ layout/              # 页面布局
│  ├─ router/              # 路由配置与权限守卫
│  ├─ stores/              # Pinia 状态管理
│  ├─ utils/               # 请求实例与工具方法
│  ├─ views/               # 页面模块
│  │  ├─ auth/             # 登录
│  │  ├─ chat/             # 智能问答 / 数字人
│  │  ├─ home/             # 控制台框架
│  │  ├─ map/              # 地图工作台与导游地图
│  │  ├─ overview/         # 数据概览
│  │  ├─ report/           # 日报
│  │  ├─ reservation/      # 预约大屏与预约管理
│  │  └─ user/             # 用户管理
│  ├─ App.vue
│  ├─ main.js
│  └─ style.css
├─ index.html
├─ vite.config.js
├─ package.json
└─ pnpm-lock.yaml
```

## 环境要求

建议使用：

- Node.js 18 或更高版本
- pnpm

项目已提交 `pnpm-lock.yaml`，推荐使用 pnpm 安装依赖，避免不同包管理器产生锁文件差异。

## 快速开始

安装依赖：

```bash
pnpm install
```

启动开发服务：

```bash
pnpm dev
```

Vite 会在终端输出本地访问地址，通常为：

```text
http://localhost:5173/
```

## 环境变量

项目根目录使用 `.env` 配置后端接口、数字人服务和地图服务地址：

```env
VITE_API_BASE_URL=http://127.0.0.1:8080
VITE_DIGITAL_HUMAN_API_URL=http://127.0.0.1:8010
VITE_DIGITAL_HUMAN_GUIDE_API_URL=
VITE_DIGITAL_HUMAN_SERVICE_API_URL=
VITE_MAP_STYLE_URL=
VITE_MAP_VECTOR_SOURCE_URL=http://127.0.0.1:3000/china
VITE_MAP_RASTER_TILE_URL=
VITE_MAP_TILE_ATTRIBUTION=Local Martin tiles
```

变量说明：

- `VITE_API_BASE_URL`：后端 API 服务地址。
- `VITE_DIGITAL_HUMAN_API_URL`：数字人服务默认地址。
- `VITE_DIGITAL_HUMAN_GUIDE_API_URL`：导览数字人服务地址；未配置时回退到 `VITE_DIGITAL_HUMAN_API_URL`。
- `VITE_DIGITAL_HUMAN_SERVICE_API_URL`：通用数字人服务地址；未配置时回退到 `VITE_DIGITAL_HUMAN_API_URL`。
- `VITE_MAP_STYLE_URL`：MapLibre `style.json` 地址；为空时使用项目内默认地图配置逻辑。
- `VITE_MAP_VECTOR_SOURCE_URL`：Martin TileJSON / vector source 地址。
- `VITE_MAP_RASTER_TILE_URL`：栅格瓦片地址；为空时回退到默认底图配置。
- `VITE_MAP_TILE_ATTRIBUTION`：地图瓦片版权信息。

开发环境下，业务接口会先访问 `/api`，再由 Vite proxy 转发到 `VITE_API_BASE_URL`。相关配置位于 `vite.config.js`。

## 常用脚本

```bash
pnpm dev
```

启动本地开发服务。

```bash
pnpm build
```

构建生产环境产物，输出到 `dist/`。

```bash
pnpm preview
```

本地预览生产构建结果。

## 路由入口

主要页面入口：

- `/normal/login`：普通用户登录。
- `/admin/login`：管理员登录。
- `/dashboard`：控制台主入口，根据身份展示不同菜单。
- `/tourist-map`：导游地图。
- `/chat`：智能问答，仅普通用户可访问。
- `/admin/create`：新增管理员，仅超级管理员可访问。

控制台内部也支持通过查询参数切换视图，例如：

- `/dashboard?view=user-reservation-dashboard-screen`：普通用户预约状态大屏。
- `/dashboard?view=reservation-dashboard-screen`：管理员预约运营大屏。
- `/dashboard?view=reservation-workspace`：景点预约或预约管理。
- `/dashboard?view=map-workspace`：地图业务控制台。
- `/dashboard?view=daily-report`：日报管理。

路由守卫会根据 Pinia 中保存的登录信息进行访问控制。登录状态持久化 key 为 `wanlv-user-auth`。

## 权限说明

- 游客：可直接查看数据大屏和导游地图。
- 普通用户：可查看普通用户数据大屏、导游地图、景点预约、智能问答和个人信息修改。
- 管理员：可查看管理员数据大屏、导游地图、地图业务控制台、预约管理和用户管理。
- 超级管理员：在管理员能力基础上，可新增管理员并使用日报管理。

## 接口约定

接口请求统一通过 `src/utils/request.js` 中的 axios 实例发起：

- 开发环境：`baseURL` 为 `/api`，通过 Vite proxy 转发。
- 生产环境：`baseURL` 为 `VITE_API_BASE_URL`。
- 默认超时时间：`600000ms`。
- 登录成功后会统一携带 `Authorization: Bearer <token>`。
- 响应数据默认按 `{ code, msg, data }` 结构处理，`code === 200` 时返回 `data`。
- `code === 401` 或 HTTP 401 会清理本地登录状态，并跳转到对应登录页。

主要接口封装：

- `src/api/user.js`：用户登录、注册、验证码、实名、用户增删改查与分页。
- `src/api/map.js`：景区、景点、路线、路线地理数据、地理要素、地图初始化与交互日志。
- `src/api/reservation.js`：预约景点、预约时段、预约订单、规则、时段、订单与运营看板。
- `src/api/chat.js`：Agent 问答、会话分析、日报分析、景区绑定和数字人服务。

## 地图与预约文档

- 预约运营看板聚合接口说明见 `docs/reservation-dashboard-api.md`。
- 地图默认配置位于 `src/views/map/mapBaseConfig.js`。
- 预约相关页面集中在 `src/views/reservation/`。

## 构建部署

执行：

```bash
pnpm build
```

构建完成后，将 `dist/` 目录部署到静态资源服务器即可。生产环境需要确认：

- `VITE_API_BASE_URL` 指向可访问的后端服务。
- 数字人相关环境变量指向可访问的数字人服务。
- 地图相关环境变量指向可访问的地图服务或瓦片服务。
- 后端已正确配置跨域，或前端静态服务已做好反向代理。

## 开发约定

- 新增页面建议放在 `src/views/` 下按业务模块拆分。
- 新增接口建议放在 `src/api/` 下统一封装。
- 全局登录用户信息通过 `src/stores/user.js` 管理。
- 路由权限规则集中维护在 `src/router/index.js`。
- 地图相关工具、默认配置和交互组件集中在 `src/views/map/`。
- 预约相关规则、订单、时段和大屏页面集中在 `src/views/reservation/`。
- 项目使用 UTF-8 编码，新增重点逻辑请补充简洁中文注释。
