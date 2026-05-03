# 万旅前端项目

`wanlv-web` 是万旅系统的前端工程，基于 Vue 3、Vite、Element Plus、Pinia 和 MapLibre GL 构建，提供普通用户端、管理员端、景区地图、智能问答、用户管理等页面能力。

## 技术栈

- Vue 3 + Vite
- Vue Router
- Pinia + pinia-plugin-persistedstate
- Element Plus + @element-plus/icons-vue
- Axios
- MapLibre GL
- Turf / @turf/turf
- Sass

## 功能模块

- 登录注册：普通用户登录、普通用户注册、管理员登录。
- 用户中心：用户信息展示、用户资料编辑、普通用户列表、管理员列表。
- 权限控制：登录态校验、管理员权限、超级管理员权限、普通用户专属页面控制。
- 景区地图：景区、景点、路线、地理要素管理与地图交互展示。
- 游客地图：面向游客/普通用户的景区导览地图。
- 智能问答：普通用户可使用的问答页面。
- 数据概览：控制台与概览页面。
- 日报模块：日报相关页面。

## 目录结构

```text
wanlv-web
├─ public/                 # 静态资源
├─ src/
│  ├─ api/                 # 后端接口封装
│  ├─ components/          # 通用组件
│  ├─ layout/              # 页面布局
│  ├─ router/              # 路由配置与权限守卫
│  ├─ stores/              # Pinia 状态管理
│  ├─ utils/               # 工具方法与请求实例
│  ├─ views/               # 页面模块
│  │  ├─ auth/             # 登录注册
│  │  ├─ chat/             # 智能问答
│  │  ├─ home/             # 首页/控制台
│  │  ├─ map/              # 地图工作台与游客地图
│  │  ├─ overview/         # 数据概览
│  │  ├─ report/           # 日报
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

项目已提交 `pnpm-lock.yaml`，推荐使用 pnpm 安装依赖。

## 快速开始

安装依赖：

```bash
pnpm install
```

启动开发服务：

```bash
pnpm dev
```

默认情况下，Vite 会在终端输出本地访问地址，例如：

```text
http://localhost:5173/
```

## 环境变量

项目根目录使用 `.env` 配置后端接口与地图服务地址：

```env
VITE_API_BASE_URL=http://127.0.0.1:8080
VITE_MAP_STYLE_URL=
VITE_MAP_VECTOR_SOURCE_URL=http://127.0.0.1:3000/china
VITE_MAP_RASTER_TILE_URL=
VITE_MAP_TILE_ATTRIBUTION=Local Martin tiles
```

说明：

- `VITE_API_BASE_URL`：后端 API 服务地址。
- `VITE_MAP_STYLE_URL`：MapLibre style.json 地址；为空时使用项目内的默认地图配置逻辑。
- `VITE_MAP_VECTOR_SOURCE_URL`：Martin TileJSON / vector source 地址。
- `VITE_MAP_RASTER_TILE_URL`：栅格瓦片地址；为空时会回退到默认底图配置。
- `VITE_MAP_TILE_ATTRIBUTION`：地图瓦片版权信息。

开发环境下，请求会先访问 `/api`，再由 Vite 代理转发到 `VITE_API_BASE_URL`。相关配置位于 `vite.config.js`。

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

主要页面入口包括：

- `/normal/login`：普通用户登录
- `/normal/register`：普通用户注册
- `/admin/login`：管理员登录
- `/dashboard`：控制台
- `/chat`：智能问答
- `/tourist-map`：游客地图
- `/admin/create`：新增管理员

路由守卫会根据 Pinia 中保存的登录信息进行访问控制。登录状态持久化 key 为 `wanlv-user-auth`。

## 请求约定

接口请求统一通过 `src/utils/request.js` 中的 axios 实例发起：

- 开发环境：`baseURL` 为 `/api`，通过 Vite proxy 转发。
- 生产环境：`baseURL` 为 `VITE_API_BASE_URL`。
- 默认超时时间：`600000ms`。
- 响应数据默认按 `{ code, msg, data }` 结构处理，`code === 200` 时返回 `data`。

## 构建部署

执行：

```bash
pnpm build
```

构建完成后，将 `dist/` 目录部署到静态资源服务器即可。生产环境需要确保：

- `VITE_API_BASE_URL` 指向可访问的后端服务。
- 地图相关环境变量指向可访问的地图服务或瓦片服务。
- 后端已正确配置跨域或前端服务器已做好反向代理。

## 开发说明

- 新增页面建议放在 `src/views/` 下按业务模块拆分。
- 新增接口建议放在 `src/api/` 下统一封装。
- 全局登录用户信息通过 `src/stores/user.js` 管理。
- 路由权限规则集中维护在 `src/router/index.js`。
- 地图相关工具、默认配置和交互组件集中在 `src/views/map/`。
