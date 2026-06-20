# 万旅前端项目结构与组件职责说明

本文档用于快速了解 `wanlv-web` 前端项目的目录组织、核心模块职责、页面组件分工和主要数据流。项目基于 Vue 3 + Vite 构建，业务上围绕用户登录、预约管理、景区地图、智能问答、数据大屏和用户管理展开。

## 一、项目总体结构

```text
wanlv-web/
├── public/                 # 静态资源，如 favicon、默认头像、图标文件
├── docs/                   # 项目补充文档
├── prototypes/             # 页面原型或早期静态稿
├── dist/                   # Vite 构建产物
├── src/                    # 前端源码主目录
│   ├── api/                # 后端接口封装
│   ├── components/         # 通用组件
│   ├── composables/        # 可复用组合式逻辑
│   ├── layout/             # 页面整体布局
│   ├── router/             # 路由和访问控制
│   ├── stores/             # Pinia 状态管理
│   ├── utils/              # 请求、提示等公共工具
│   ├── views/              # 业务页面
│   ├── App.vue             # 应用根组件
│   ├── main.js             # 应用入口
│   └── style.css           # 全局样式
├── index.html              # Vite HTML 入口
├── package.json            # 脚本和依赖配置
├── pnpm-lock.yaml          # pnpm 依赖锁定文件
└── vite.config.js          # Vite 配置、路径别名和开发代理
```

## 二、入口与基础配置

### `src/main.js`

项目的应用启动入口，主要完成以下初始化：

- 创建 Vue 应用实例。
- 注册 Naive UI、Element Plus。
- 注册 Pinia，并启用 `pinia-plugin-persistedstate` 做登录状态持久化。
- 注册 Vue Router。
- 引入全局样式和第三方组件库样式。

当前项目同时保留了 Naive UI 和 Element Plus：Naive UI 主要承担新的整体 UI 能力，Element Plus 仍用于部分历史页面、地图图标和表单交互。

### `src/App.vue`

应用根组件，外层包裹 Naive UI 的全局 provider：

- `n-config-provider`：统一中文语言包、日期语言包和主题覆盖。
- `n-loading-bar-provider`：全局加载条。
- `n-dialog-provider`、`n-notification-provider`、`n-message-provider`：全局弹窗、通知和消息。
- 内部通过 `<router-view />` 渲染当前路由页面。

### `vite.config.js`

主要配置内容：

- Vue 插件。
- Naive UI 组件自动导入。
- `@` 路径别名，指向 `src`。
- 开发环境 `/api` 代理，将前端请求转发到 `.env` 中的 `VITE_API_BASE_URL`。

## 三、路由与访问控制

### `src/router/index.js`

项目当前显式路由入口包括：

- `/normal/login`：普通用户登录。
- `/admin/login`：管理员登录。
- `/dashboard`：控制台主入口。
- `/chat`：智能问答页面，仅普通用户可访问。
- `/tourist-map`：导游地图。
- `/admin/create`：新增管理员，仅超级管理员可访问。

路由守卫主要负责：

- 判断公开页面和需要登录的页面。
- 游客允许访问 `/dashboard` 和 `/tourist-map`。
- 未登录访问受限页面时，跳转到对应登录页并携带 `redirect`。
- 校验超级管理员权限。
- 限制管理员访问普通用户专属的智能问答页面。
- 根据路由 `meta.title` 更新浏览器标题。

## 四、状态管理

### `src/stores/index.js`

统一导出 Pinia 实例和各业务 store，方便在路由、请求工具和组件中直接引用。

### `src/stores/user.js`

用户登录态和用户信息的核心 store，职责包括：

- 保存 `userInfo` 和 `isLogin`。
- 计算登录 token、用户 ID、用户名、展示名、角色、用户类型。
- 判断是否登录、是否管理员、是否超级管理员、是否完成实名认证。
- 登录后规范化用户信息，补齐 `displayName` 和 `token`。
- 支持局部更新用户资料。
- 清理登录状态。
- 使用 `wanlv-user-auth` 持久化登录信息到 `localStorage`。

### `src/stores/app.js`

偏后台框架型的 UI 状态管理，保存侧边栏折叠状态、访问过的页面标签等。当前主控制台已经有自己的菜单逻辑，因此这个 store 更像是保留的后台框架能力。

## 五、接口层

接口请求统一走 `src/utils/request.js` 中的 axios 实例。

### `src/utils/request.js`

核心职责：

- 开发环境使用 `/api` 作为 baseURL，生产环境使用 `VITE_API_BASE_URL`。
- 默认超时时间为 600000ms。
- 请求前自动从 `userStore.token` 追加 `Authorization: Bearer <token>`。
- 响应按 `{ code, msg, data }` 结构处理。
- `code === 200` 时返回 `data`。
- 普通用户收到 `code === 401` 或 HTTP 401 时单飞刷新 Token，并在成功后重放原请求。
- 刷新失败、重放后仍为 401 或管理员请求返回 401 时，清理登录状态并跳转对应登录页。
- 其他错误统一通过反馈工具提示。

### `src/api/user.js`

用户相关接口封装，包括：

- 超级管理员初始化。
- 管理员登录、新增、更新、详情、删除、分页。
- 普通用户注册、账号登录、验证码发送、验证码登录、退出登录。
- 普通用户实名认证、资料更新、详情、删除、分页。

### `src/api/reservation.js`

预约相关接口封装，包括：

- 查询可预约景点和预约时段。
- 创建、取消、查询用户预约订单。
- 管理员确认入园。
- 预约规则增改查和状态修改。
- 预约时段生成、创建、修改、分页。
- 管理端订单分页。
- 预约运营大屏聚合数据。

### `src/api/map.js`

地图业务接口封装，包括：

- 景区、景点、路线的增删改查和分页。
- 路线地理数据创建、更新、查询、自动生成。
- 空间要素创建、更新、删除、列表。
- 地图初始化数据。
- Agent 生成的最新个性化路线。
- 地图交互日志上报。

### `src/api/chat.js`

智能问答和数字人接口封装，包括：

- Agent 问答。
- 会话分析和日分析。
- 会话绑定景区。
- 数字人播报、语音状态、WebRTC offer、录音、打断等接口。

## 六、布局与通用组件

### `src/layout/AdminLayout.vue`

项目外层布局组件，负责：

- 顶部品牌区和导航。
- 根据登录状态和用户角色动态显示菜单。
- 游客只显示数据大屏和导游地图。
- 普通用户显示数据大屏、智能问答、导游地图。
- 超级管理员额外显示新增管理员入口。
- 登录用户展示用户名、角色标签和退出登录按钮。
- `/dashboard` 页面使用紧凑全屏布局，其他页面显示顶部 header。

### `src/components/auth/AuthShell.vue`

登录页通用外壳组件，承载登录页面的品牌视觉、标题、副标题、提示文案和表单插槽。`AdminLogin.vue`、`NormalLogin.vue` 通过它复用统一登录页结构。

## 七、业务页面目录

### `src/views/auth/`

登录相关页面：

- `NormalLogin.vue`：普通用户登录，支持账号登录、验证码登录、注册等普通用户入口。
- `AdminLogin.vue`：管理员登录，支持初始化超级管理员和填充默认账号等辅助操作。

### `src/views/home/Dashboard.vue`

控制台主页面，是当前项目最重要的业务聚合入口。

主要职责：

- 根据用户身份生成不同菜单。
- 游客可访问数据大屏和导游地图。
- 普通用户可访问用户数据大屏、导游地图、景点预约、智能问答。
- 管理员可访问管理数据大屏、导游地图、地图业务控制台、预约管理、用户管理。
- 超级管理员额外可访问日报管理和新增管理员。
- 通过 `route.query.view` 支持在 `/dashboard?view=xxx` 中切换内部视图。
- 使用异步组件加载地图工作台、预约工作台和大屏页面，降低首屏负担。

`Dashboard.vue` 内部聚合的主要页面包括：

- `ReservationDashboardScreen.vue`
- `UserReservationDashboardScreen.vue`
- `ReservationWorkspace.vue`
- `MapWorkspace.vue`
- `TouristMap.vue`
- `Chat-2.0.vue`
- `DailyReport.vue`
- 用户列表、用户详情、个人资料编辑和新增管理员页面。

### `src/views/reservation/`

预约业务页面目录。

- `ReservationDashboardScreen.vue`：管理员预约运营大屏，展示今日预约、游客数、容量利用率、取消率、热力景点、趋势图、来源分布、状态分布和预警等信息。
- `UserReservationDashboardScreen.vue`：普通用户侧预约状态大屏，更偏用户可理解的预约情况展示。
- `ReservationWorkspace.vue`：预约业务工作台。普通用户用于景点预约、选择日期时段、填写游客信息、查看和取消自己的订单；管理员用于维护预约规则、生成或编辑时段、查看订单并确认入园。

### `src/views/map/`

地图业务目录，是 MapLibre 相关能力的集中位置。

- `MapWorkspace.vue`：地图业务管理工作台，负责景区、景点、路线、路线地理数据、空间要素和交互日志等管理。
- `TouristMap.vue`：游客/用户/管理员均可使用的导游地图页面，支持选择景区、展示景点、官方路线、Agent 个性化路线和景区信息。
- `MapCanvas.vue`：MapLibre 地图渲染核心组件，负责底图、景区边界、空间要素、路线、景点 marker、定位和点选位置等交互。
- `ScenicAreaPicker.vue`：景区边界或范围选择辅助组件。
- `SpotLocationPicker.vue`：景点经纬度选择辅助组件。
- `FeatureGeometryPicker.vue`：空间要素几何绘制/选择辅助组件。
- `UserMapControls.vue`：导游地图侧边/浮层控制组件。
- `mapBaseConfig.js`：地图底图和默认样式配置。
- `mapUtils.js`：GeoJSON、边界、距离、分页数据标准化等地图工具函数。

### `src/views/chat/`

智能问答和数字人页面目录。

- `Chat-2.0.vue`：当前路由使用的新版智能问答页，支持 Agent 问答、景区识别/绑定、数字人 WebRTC 连接、语音输入、头像选择、移动端适配、温馨提醒等功能。
- `Chat.vue`：旧版或备用智能问答页面。
- `ChatBF.vue`：较早的数字人/问答实现版本，保留作参考或兼容。

### `src/views/user/`

用户管理和个人资料目录。

- `AdminCreate.vue`：新增管理员，超级管理员使用。
- `AdminUserList.vue`：管理员分页列表。
- `AdminUserDetail.vue`：管理员详情查询。
- `NormalUserList.vue`：普通用户分页列表，支持状态变更和删除。
- `NormalUserDetail.vue`：普通用户详情查询。
- `UserProfileEdit.vue`：当前登录用户修改个人资料；普通用户还包含实名认证相关表单和景区偏好信息。
- `userViewUtils.js`：用户页面格式化工具，如时间、状态、性别、兴趣标签、分页结果标准化。

### `src/views/report/`

- `DailyReport.vue`：日报和会话分析页面，调用 Agent 分析接口，支持单会话分析和按日期批量分析。

### `src/views/overview/`

- `DashboardOverview.vue`：较轻量的数据概览页面，目前未在显式路由中直接挂载，更像历史概览页或备用组件。

## 八、组合式逻辑

### `src/composables/useScenicWarmReminder.js`

景区游玩温馨提醒逻辑，主要用于导游地图和智能问答页面。

职责包括：

- 根据当前用户和景区 ID 生成 sessionStorage key。
- 避免短时间内重复提醒。
- 在用户停留一段时间后，结合用户资料、景区名称和当前时间构造 prompt。
- 调用 Agent 问答接口生成温馨提醒。
- 使用 Element Plus 消息展示提醒内容。
- 组件卸载时自动清理定时器。

## 九、主要业务流

### 登录与权限流

1. 用户进入登录页提交账号信息。
2. 普通用户登录接口返回用户信息、token 和 refreshToken，管理员登录只返回 token。
3. `userStore.setLogin()` 规范化并持久化用户信息。
4. 后续请求由 `request.js` 自动携带 token。
5. 路由守卫根据 `isLoggedIn`、`isAdmin`、`isSuperAdmin` 控制页面访问。
6. 普通用户 token 失效时单飞刷新并重放请求；刷新失败或管理员接口返回 401 时清理登录态并跳转登录页。

### 控制台页面切换流

1. 用户访问 `/dashboard`。
2. `Dashboard.vue` 根据身份生成菜单。
3. 默认进入普通用户或管理员对应的数据大屏。
4. 点击菜单时切换 `activeMenu`。
5. 如果 URL 携带 `?view=xxx`，页面会同步到对应内部视图。

### 预约业务流

普通用户：

1. 选择景区和景点。
2. 查询可预约时段。
3. 选择时段并填写联系人、游客信息。
4. 提交预约订单。
5. 在我的订单中查看或取消预约。

管理员：

1. 维护预约规则。
2. 按规则批量生成预约时段，或手动维护临时时段。
3. 查询预约订单。
4. 对到场游客执行入园确认。
5. 通过预约大屏查看运营状态。

### 地图业务流

管理端：

1. 在地图工作台维护景区基础信息和边界。
2. 维护景点坐标、类型、推荐等级和展示信息。
3. 维护路线及其关联景点。
4. 维护路线 GeoJSON 或调用生成接口。
5. 维护空间要素，如道路、区域、服务设施等。

用户端：

1. 在导游地图选择景区。
2. 加载景区初始化数据。
3. 地图展示景区范围、景点、路线和空间要素。
4. 登录用户可加载 Agent 个性化路线。
5. 页面同步景区 ID 和景区名到 URL query，方便智能问答等页面读取上下文。

### 智能问答与数字人流

1. 用户进入智能问答页。
2. 页面从 URL 或会话中读取景区上下文。
3. 发送问题到 Agent 接口。
4. Agent 返回回答、景区识别结果和会话状态。
5. 用户可确认绑定识别到的景区。
6. 数字人能力通过 WebRTC 和数字人服务接口完成连接、播报、打断和语音输入。

## 十、开发维护建议

- 新增业务接口优先放到 `src/api/`，保持按业务域拆分。
- 新增页面优先放到 `src/views/业务模块/`，再由 `Dashboard.vue` 或 `router/index.js` 挂载。
- 公共状态放到 `src/stores/`，页面内临时状态保留在组件中。
- 地图相关工具、配置和组件尽量集中在 `src/views/map/`，避免 GeoJSON 逻辑散落到其他模块。
- 预约业务尽量集中在 `src/views/reservation/`，接口统一走 `src/api/reservation.js`。
- 全局请求错误、登录失效、消息提示优先复用 `src/utils/request.js` 和 `src/utils/feedback.js`。
- 重点业务逻辑建议补充简短中文注释，尤其是权限判断、数据格式转换、地图坐标处理、预约容量计算和数字人连接逻辑。
