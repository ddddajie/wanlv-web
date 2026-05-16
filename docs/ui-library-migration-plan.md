# UI 组件库使用与迁移建议

本文档记录当前项目中 Naive UI 与 Element Plus 的使用边界，方便后续按页面逐步调整，避免同一类页面风格混乱。

## 一、总体原则

当前项目同时保留 Naive UI 和 Element Plus，建议不要一次性全量替换，而是按页面属性分层处理。

```text
用户侧 / 外壳 / 高交互体验：优先使用 Naive UI + Tailwind CSS
管理侧 / 表格表单 / 存量后台：优先保留 Element Plus
```

核心判断标准：

- 用户频繁看到、移动端也会使用、对视觉体验要求较高的页面，优先迁移到 Naive UI。
- 管理员使用较多、包含复杂表格、分页、筛选、批量操作、复杂表单的页面，暂时保留 Element Plus。
- 尽量避免同一个小区域内 Naive UI 和 Element Plus 混用；如果父级外壳用 Naive UI，内部业务子页面仍可保持 Element Plus。

## 二、推荐迁移到 Naive UI 的页面

这些页面更偏用户体验、入口体验或高频交互，建议后续优先使用 Naive UI 统一视觉。

### 1. 登录相关

- `src/components/auth/AuthShell.vue`
- `src/views/auth/NormalLogin.vue`
- `src/views/auth/AdminLogin.vue`

原因：

- 登录页是用户和管理员的第一入口，视觉统一收益高。
- 表单复杂度不高，迁移成本相对可控。
- 适合使用 Naive UI 的 `n-form`、`n-input`、`n-button`、`n-tabs`、`n-card` 等组件。

### 2. 控制台外壳

- `src/views/home/Dashboard.vue`

当前状态：

- 菜单栏已改为 Naive UI + Tailwind CSS。
- `n-menu`、`n-avatar`、`n-button` 已用于左侧用户菜单区域。

后续建议：

- 继续保持 Dashboard 外壳使用 Naive UI。
- Dashboard 内部挂载的管理类业务组件可以继续保留 Element Plus。

### 3. 导游地图

- `src/views/map/TouristMap.vue`
- `src/views/map/UserMapControls.vue`

原因：

- 导游地图是用户侧核心体验页。
- 地图浮层、景区选择、路线切换、咨询入口、移动端交互都更适合 Naive UI 的轻量风格。
- 可逐步迁移按钮、选择器、抽屉、弹窗、消息提示等外围 UI，地图核心渲染逻辑不需要动。

### 4. 智能问答

- `src/views/chat/Chat-2.0.vue`

原因：

- 智能问答是高交互用户页面，对视觉体验和移动端适配要求较高。
- 适合使用 Naive UI 的输入框、按钮、弹窗、抽屉、标签、加载状态等组件。
- 数字人连接、语音输入、景区绑定等重点交互建议保持清晰轻量。

### 5. 用户侧预约状态

- `src/views/reservation/UserReservationDashboardScreen.vue`

原因：

- 这是普通用户查看预约状态的数据页，偏展示和体验。
- 适合 Naive UI 的卡片、统计组件、标签、空状态、提示等轻量表达。

### 6. 个人资料

- `src/views/user/UserProfileEdit.vue`

原因：

- 属于用户侧资料维护和实名认证入口。
- 虽然有表单，但更偏个人体验，不是后台批量管理。
- 适合迁移到 Naive UI 的 `n-form`、`n-input`、`n-select`、`n-upload`、`n-date-picker` 等组件。

## 三、建议暂时保留 Element Plus 的页面

这些页面偏管理后台，常见需求是表格、分页、筛选、编辑表单和批量操作。Element Plus 在这类场景里稳定成熟，建议先保留。

### 1. 预约管理工作台

- `src/views/reservation/ReservationWorkspace.vue`

保留原因：

- 包含预约规则、时段维护、订单查询、入园确认等复杂后台业务。
- 表格、分页、弹窗表单较多，迁移成本较高。
- 当前继续使用 Element Plus 更稳。

### 2. 地图业务管理工作台

- `src/views/map/MapWorkspace.vue`
- `src/views/map/ScenicAreaPicker.vue`
- `src/views/map/SpotLocationPicker.vue`
- `src/views/map/FeatureGeometryPicker.vue`

保留原因：

- 偏管理端配置和地理数据维护。
- 涉及景区、景点、路线、空间要素的管理表单和编辑流。
- 地图绘制/选择逻辑比 UI 库更关键，暂时不建议为迁移组件库而扩大改动范围。

### 3. 用户管理

- `src/views/user/AdminUserList.vue`
- `src/views/user/NormalUserList.vue`
- `src/views/user/AdminUserDetail.vue`
- `src/views/user/NormalUserDetail.vue`
- `src/views/user/AdminCreate.vue`

保留原因：

- 主要服务管理员，偏传统后台。
- 列表、分页、查询、详情、删除、状态变更等 Element Plus 场景匹配度高。
- 后续如果统一管理端风格，再集中迁移更合适。

### 4. 报表与分析

- `src/views/report/DailyReport.vue`

保留原因：

- 偏管理端分析和操作。
- 如果页面包含表格、筛选、日期选择、结果面板，Element Plus 可以继续承载。
- 后续可根据实际视觉要求单独优化。

### 5. 管理员数据大屏

- `src/views/reservation/ReservationDashboardScreen.vue`

保留原因：

- 虽然是展示页，但主要面向管理员运营分析。
- 目前大屏类页面通常自定义样式较多，组件库影响相对较小。
- 如需改造，建议优先调整视觉样式和图表布局，不必急着替换组件库。

## 四、公共能力迁移建议

### 1. 全局反馈

优先使用：

- `src/utils/feedback.js`

建议：

- 新代码统一通过该工具触发消息、弹窗、通知。
- 避免业务页面直接散落 `ElMessage`、`ElMessageBox`、`useMessage` 等调用。
- 如果未来要完全统一反馈风格，只需要优先维护这个工具。

### 2. 外壳与导航

优先使用 Naive UI：

- 顶部导航
- 侧边菜单
- 移动端抽屉
- 用户信息区
- 登录态操作按钮

原因：

- 这些区域跨页面出现，统一后项目观感会明显更稳定。

### 3. 表格与复杂表单

管理端暂时保留 Element Plus：

- 大数据表格
- 分页列表
- 筛选表单
- 批量操作
- 管理端编辑弹窗

原因：

- 迁移成本高。
- 业务风险比视觉收益更大。

## 五、建议修改顺序

建议按下面顺序逐步推进：

1. 登录页：`AuthShell.vue`、`NormalLogin.vue`、`AdminLogin.vue`
2. 用户核心页：`TouristMap.vue`、`UserMapControls.vue`
3. 智能问答：`Chat-2.0.vue`
4. 用户侧预约与资料：`UserReservationDashboardScreen.vue`、`UserProfileEdit.vue`
5. 统一反馈工具：逐步收敛到 `src/utils/feedback.js`
6. 管理端页面：暂不主动迁移，后续按需求单独评估

## 六、执行注意事项

- 每次只迁移一个页面或一个明确区域，避免一次改动过大。
- 保留原有中文文案和中文注释，文件仍使用 UTF-8 编码。
- 重点权限判断、数据格式转换、地图坐标处理、预约容量计算、数字人连接逻辑要补充简短中文注释。
- 迁移 UI 时尽量不改变业务逻辑，先保证交互和接口行为一致。
- 每次修改后至少执行 `npm run build`。
- 涉及地图、聊天、预约提交等关键交互时，建议再进行浏览器手动验证。
