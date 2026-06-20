# 数字人连接与会话释放说明

## 问题原因

`/interrupt_talk` 只会停止播报，不会关闭 `RTCPeerConnection`，也不会归还或销毁服务端 session。安卓 APP、WebView 退后台或网络切换时，服务端连接可能长时间停留在 `disconnected`，上一次 session 因此继续占用资源。

当前前端统一执行以下策略：

1. `/offer` 成功后保存 `sessionid` 和创建该会话的数字人服务地址。
2. 手动断开、切换形象、连接失败、连接超时、持续断线、路由销毁、页面隐藏和页面退出时，先立即关闭本地音视频轨道，再请求 `POST /session/close`。
3. `/offer` 返回前用户已经退出时，将迟到的 `sessionid` 立即释放，避免产生孤儿会话。
4. `disconnected` 保留 4 秒恢复窗口，仍未恢复才释放；`failed` 和 `closed` 立即释放。
5. 页面卸载和安卓 WebView 退后台使用 `fetch keepalive`，提高退出期间释放请求的送达概率。

## 服务端关闭接口

数字人服务需要新增以下幂等接口：

```http
POST /session/close
Content-Type: application/json

{
  "sessionid": 123456,
  "reason": "page_hidden"
}
```

成功响应：

```json
{
  "code": 0,
  "msg": "ok",
  "released": true
}
```

会话已不存在时也返回成功，但 `released` 为 `false`。接口必须幂等，因为页面生命周期事件和 WebRTC 状态事件可能同时触发。

### `Wanlv-livetalking` 接入位置

在 `app.py` 创建 `appasync` 后暴露连接管理器：

```python
appasync["rtc_manager"] = rtc_manager
```

在 `server/routes.py` 增加路由：

```python
async def close_session(request):
    """主动关闭 PeerConnection，并幂等释放数字人会话。"""
    try:
        params = await request.json()
        sessionid = int(params.get("sessionid", 0))
        if sessionid <= 0:
            return json_error("invalid sessionid")

        rtc_manager = request.app["rtc_manager"]
        released = await rtc_manager.close_session(sessionid)
        return json_ok({"released": released})
    except Exception as error:
        logger.exception("close_session exception:")
        return json_error(str(error))


def setup_routes(app):
    # 保留原有路由
    app.router.add_post("/session/close", close_session)
```

`server/rtc_manager.py` 需要维护 `sessionid -> PeerConnection` 的映射，并提供：

```python
async def close_session(self, sessionid: int) -> bool:
    """由客户端主动断开；重复调用不会重复归还 session。"""
    connection = self.session_connections.pop(sessionid, None)
    if connection is None:
        return False

    pc, release_session = connection
    await pc.close()
    self.pcs.discard(pc)
    await release_session()
    return True
```

创建连接时将已有的 `release_current_session` 回调保存到映射：

```python
self.session_connections[sessionid] = (pc, release_current_session)
```

`release_current_session` 内也要执行 `self.session_connections.pop(sessionid, None)`。这样 HTTP 主动关闭、WebRTC `failed/closed` 自动关闭和服务停机清理最终都会进入同一个幂等释放函数。服务端还应为长时间 `disconnected` 增加超时释放，兜住 APP 被系统直接杀死、关闭请求无法发送的情况。

## 安卓 APP 生命周期

如果安卓 APP 直接维护原生 WebRTC，请在 `onStop` 中发送关闭请求并立即释放本地 PeerConnection；不要只调用停止播报接口：

```kotlin
override fun onStop() {
    digitalHumanConnection.close(reason = "android_on_stop")
    super.onStop()
}
```

`close()` 需要先原子地取出并清空当前 `sessionid`，随后执行两件事：

```kotlin
peerConnection?.close()
peerConnection?.dispose()
peerConnection = null

// 使用 IO 协程并设置短超时，请求体为 sessionid + reason。
api.closeSession(CloseSessionRequest(sessionId, reason))
```

连接期间应使用递增的 `attemptId`。当 `/offer` 返回时，若该 ID 已不是当前连接，立即调用 `/session/close` 释放响应中的 session，不能再设置远端 SDP。

如果 APP 使用本项目的 WebView 页面，页面已经监听 `visibilitychange`、`pagehide` 和 `beforeunload`；原生层仍建议在 `onStop` 主动通知 WebView 进入隐藏状态，服务端超时回收继续作为最终兜底。

## 本地局域网为什么不需要 STUN/TURN

WebRTC 是浏览器/APP 与数字人服务之间传输实时音视频的协议，本项目仍然需要它。可以不使用的是外部 **STUN/TURN 服务器**：当手机和数字人服务电脑位于同一个局域网、彼此能直接访问时，host ICE candidate 就足够建立连接。

配置保持为空：

```env
VITE_DIGITAL_HUMAN_STUN_SERVER=
```

安卓真机不能使用电脑开发环境里的 `127.0.0.1`。应改为电脑的局域网地址，例如：

```env
VITE_SERVER_HOST=192.168.1.100
VITE_DIGITAL_HUMAN_GUIDE_API_URL=http://192.168.1.100:8011
VITE_DIGITAL_HUMAN_SERVICE_API_URL=http://192.168.1.100:8010
```

同时确认电脑防火墙已允许对应 HTTP 和 WebRTC UDP 端口、手机与电脑处于同一网段，并且数字人服务监听 `0.0.0.0`，而不是只监听 `127.0.0.1`。
