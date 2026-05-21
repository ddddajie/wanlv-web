# 万旅前端项目

`wanlv-web` 是万旅文旅运营平台的前端工程，基于 Vue 3、Vite、Pinia、Vue Router、Naive UI、Element Plus、MapLibre GL 和 ECharts 构建。项目围绕景区游客展示、预约管理、地图导览、智能问答/数字人、用户管理和运营分析展开，面向游客、普通用户、管理员和超级管理员提供不同入口与权限能力。

## 技术栈

- Vue 3 + Vite
- Vue Router
- Pinia + pinia-plugin-persistedstate
- Naive UI + Element Plus
- Axios
- MapLibre GL
- Turf / @turf/turf
- ECharts
- Tailwind CSS 4
- Sass

## 功能模块

- 登录与权限：普通用户登录、验证码登录、注册、管理员登录、超级管理员初始化、新增管理员、游客模式访问控制。
- 控制台工作台：`/dashboard` 根据用户身份动态展示菜单，并通过 `view` 查询参数切换内部业务页面。
- 游客首页与导游地图：游客和登录用户都可以查看游客首页、数据大屏和景区导览地图。
- 景点预约：普通用户可查看可预约景点、选择日期时段、提交预约、查看和取消自己的预约订单。
- 预约管理：管理员可维护预约规则、批量生成预约时段、管理临时时段、查询订单并确认入园。
- 数据大屏：管理员预约运营大屏和普通用户预约状态大屏，覆盖容量、趋势、热度、状态分布和预警等信息。
- 景区地图管理：维护景区、景点、路线、路线 GeoJSON、空间要素和地图交互日志，核心渲染基于 MapLibre。
- 智能问答/数字人：普通用户可使用 Agent 问答、景区识别绑定、会话分析、数字人播报、语音输入和 WebRTC 连接。
- 用户管理：管理员详情、普通用户详情、管理员分页列表、普通用户分页列表、用户数字画像和个人资料编辑。
- 日报管理：超级管理员可查看智能问答会话分析和按日期聚合的日报分析。

## 目录结构

```text
wanlv-web/
├─ public/                 # 静态资源，如 favicon、默认头像、图标文件
├─ docs/                   # 项目补充文档
├─ memory/                 # 项目过程资料或临时记录
├─ src/                    # 前端源码
│  ├─ api/                 # 后端接口封装
│  ├─ assets/              # 页面图片等资源
│  ├─ components/          # 通用组件
│  ├─ composables/         # 可复用组合式逻辑
│  ├─ layout/              # 页面整体布局
│  ├─ router/              # 路由配置与权限守卫
│  ├─ stores/              # Pinia 状态管理
│  ├─ utils/               # 请求实例、消息反馈等工具
│  ├─ views/               # 业务页面
│  │  ├─ auth/             # 登录与注册
│  │  ├─ chat/             # 智能问答 / 数字人
│  │  ├─ home/             # 控制台聚合入口
│  │  ├─ index/            # 游客首页
│  │  ├─ map/              # 地图工作台与导游地图
│  │  ├─ overview/         # 历史概览或备用页面
│  │  ├─ report/           # 日报与会话分析
│  │  ├─ reservation/      # 预约大屏与预约管理
│  │  └─ user/             # 用户管理与个人资料
│  ├─ App.vue              # 全局 Provider 与路由出口
│  ├─ main.js              # 应用入口
│  └─ style.css            # 全局样式
├─ index.html              # Vite HTML 入口
├─ vite.config.js          # Vite 插件、别名和开发代理
├─ package.json            # 脚本和依赖
└─ pnpm-lock.yaml          # pnpm 锁文件
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

构建生产产物：

```bash
pnpm build
```

本地预览生产构建：

```bash
pnpm preview
```

## 环境变量

根目录 `.env` 用于配置后端接口、数字人服务和地图服务地址。常用变量如下：

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

- `VITE_API_BASE_URL`：后端 API 服务地址。开发环境下前端访问 `/api`，再由 Vite proxy 转发到该地址。
- `VITE_DIGITAL_HUMAN_API_URL`：数字人服务默认地址。
- `VITE_DIGITAL_HUMAN_GUIDE_API_URL`：导览数字人服务地址；未配置时可回退到默认数字人服务。
- `VITE_DIGITAL_HUMAN_SERVICE_API_URL`：通用数字人服务地址；未配置时可回退到默认数字人服务。
- `VITE_MAP_STYLE_URL`：MapLibre `style.json` 地址；配置后优先使用远程样式。
- `VITE_MAP_VECTOR_SOURCE_URL`：Martin TileJSON 或矢量瓦片源地址。
- `VITE_MAP_RASTER_TILE_URL`：栅格瓦片模板地址；未配置时回退到 OpenStreetMap 默认瓦片。
- `VITE_MAP_TILE_ATTRIBUTION`：地图瓦片版权信息。

## 路由入口

显式路由入口：

- `/normal/login`：普通用户登录、注册和验证码登录。
- `/admin/login`：管理员登录和超级管理员初始化入口。
- `/dashboard`：控制台主入口，根据用户身份动态展示业务菜单。
- `/chat`：智能问答独立入口，仅普通用户可访问。
- `/tourist-map`：导游地图独立入口。
- `/admin/create`：新增管理员独立入口，仅超级管理员可访问。

`/dashboard` 内部支持通过查询参数切换视图：

- `/dashboard?view=user-index`：游客首页。
- `/dashboard?view=user-reservation-dashboard-screen`：普通用户预约状态大屏。
- `/dashboard?view=reservation-dashboard-screen`：管理员预约运营大屏。
- `/dashboard?view=tourist-map`：导游地图。
- `/dashboard?view=reservation-workspace`：普通用户景点预约或管理员预约管理。
- `/dashboard?view=chat-page`：智能问答嵌入式工作区。
- `/dashboard?view=map-workspace`：地图业务控制台。
- `/dashboard?view=daily-report`：日报管理。
- `/dashboard?view=admin-create-page`：新增管理员。
- `/dashboard?view=user-digital-profile-list`：用户数字画像。
- `/dashboard?view=user-admin-detail`：管理员详情查询。
- `/dashboard?view=user-normal-detail`：普通用户详情查询。
- `/dashboard?view=user-admin-list`：管理员分页列表。
- `/dashboard?view=user-normal-list`：普通用户分页列表。

## 权限说明

- 游客：可直接访问 `/dashboard` 和 `/tourist-map`，在控制台内可查看游客首页、数据大屏和导游地图。
- 普通用户：可访问游客能力、景点预约、智能问答和个人资料修改。
- 管理员：可访问管理员数据大屏、导游地图、地图业务控制台、预约管理和用户管理。
- 超级管理员：在管理员能力基础上，可新增管理员、查看用户数字画像并使用日报管理。

路由守卫位于 `src/router/index.js`，登录状态由 `src/stores/user.js` 管理并持久化到 `localStorage`，持久化 key 为 `wanlv-user-auth`。

## 应用入口与全局配置

- `src/main.js`：创建 Vue 应用，注册 Naive UI、Element Plus、Pinia、持久化插件和 Vue Router。
- `src/App.vue`：注册 Naive UI 全局 Provider，包括中文语言包、加载条、弹窗、通知和消息。
- `src/utils/feedback.js`：封装全局 `message`、`dialog`、`notification`、`loadingBar`，并维护 Naive UI 主题变量。
- `vite.config.js`：配置 Vue、Tailwind CSS、自动导入、Naive UI 组件解析、`@` 别名和开发代理。

## 接口约定

业务请求统一通过 `src/utils/request.js` 中的 axios 实例发起：

- 开发环境：`baseURL` 为 `/api`，通过 Vite proxy 转发。
- 生产环境：`baseURL` 为 `VITE_API_BASE_URL`。
- 默认超时时间：`600000ms`。
- 登录成功后统一携带 `Authorization: Bearer <token>`。
- 响应数据默认按 `{ code, msg, data }` 结构处理，`code === 200` 时返回 `data`。
- `code === 401` 或 HTTP 401 会清理本地登录状态，并跳转到对应登录页。
- 其他业务错误会通过全局消息提示，并返回 rejected Promise。

主要接口封装：

- `src/api/user.js`：超级管理员初始化、管理员登录/新增/更新/详情/删除/分页、普通用户注册/登录/验证码/实名/更新/详情/删除/分页、用户数字画像。
- `src/api/reservation.js`：可预约景点、预约时段、用户订单、取消预约、入园确认、预约规则、时段生成、订单分页和预约运营看板。
- `src/api/map.js`：景区、景点、路线、路线地理数据、空间要素、地图初始化、Agent 最新路线和地图交互日志。
- `src/api/chat.js`：Agent 问答、会话分析、日报分析、景区绑定、数字人播报、语音状态、录音、打断和 WebRTC offer。

## 业务页面说明

- `src/views/home/Dashboard.vue`：控制台核心聚合页，根据身份生成菜单并切换内部业务视图。
- `src/views/reservation/ReservationWorkspace.vue`：普通用户景点预约和管理员预约管理共用工作台。
- `src/views/reservation/ReservationDashboardScreen.vue`：管理员预约运营大屏。
- `src/views/reservation/UserReservationDashboardScreen.vue`：普通用户预约状态大屏。
- `src/views/map/MapWorkspace.vue`：景区、景点、路线、路线地理数据和空间要素管理。
- `src/views/map/TouristMap.vue`：导游地图，支持景区选择、景点/路线展示和个性化路线。
- `src/views/map/MapCanvas.vue`：MapLibre 核心地图渲染组件。
- `src/views/chat/Chat-2.0.vue`：当前使用的智能问答/数字人页面。
- `src/views/report/DailyReport.vue`：会话分析和日报分析页面。
- `src/views/user/`：管理员、普通用户、数字画像、个人资料和新增管理员页面。

## 地图能力

地图默认配置位于 `src/views/map/mapBaseConfig.js`：

- 优先使用 `VITE_MAP_STYLE_URL` 指定的 MapLibre 样式。
- 未配置远程样式时，优先根据 `VITE_MAP_VECTOR_SOURCE_URL` 构造矢量底图。
- 未配置矢量源时，使用 `VITE_MAP_RASTER_TILE_URL` 或 OpenStreetMap 默认栅格瓦片。
- 地图工具函数集中在 `src/views/map/mapUtils.js`，用于 GeoJSON、边界、距离和分页数据标准化。

## 补充文档

- `docs/project-structure-summary.md`：更细的项目结构、组件职责和业务流说明。
- `docs/reservation-dashboard-api.md`：预约运营大屏聚合接口说明。
- `docs/ui-library-migration-plan.md`：UI 组件库迁移相关记录。

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
- 静态服务对 Vue Router history 模式做好回退配置，避免刷新非根路径时返回 404。

## 开发约定

- 新增页面优先放在 `src/views/` 下，按业务模块拆分。
- 新增接口优先放在 `src/api/` 下，保持按业务域统一封装。
- 全局登录用户信息通过 `src/stores/user.js` 管理。
- 路由权限规则集中维护在 `src/router/index.js`。
- 全局请求错误、登录失效和消息反馈优先复用 `src/utils/request.js` 与 `src/utils/feedback.js`。
- 地图相关工具、默认配置和交互组件集中在 `src/views/map/`。
- 预约相关规则、订单、时段和大屏页面集中在 `src/views/reservation/`。
- 项目使用 UTF-8 编码，不要随意改变中文注释和页面文案。
- 重点业务逻辑建议补充简洁中文注释，尤其是权限判断、数据格式转换、地图坐标处理、预约容量计算和数字人连接逻辑。
