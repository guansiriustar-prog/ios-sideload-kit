# 02 · 踩坑与排错（含本次全部真实报错）

> 这一篇是本次实战的**完整病历**：从装 App 到登录成功，一共踩了 8 个坑。
> 每个坑都给出「现象 → 判定 → 解决 → 验证」，以及一条贯穿全文的原则：**先分清是"配置问题"还是"版本问题"**。

---

## 背景：2026 年 10 月苹果到底改了什么

这是本次所有登录故障的**总根源**，理解了它，后面的报错表就能自己推理：

| 时间（2026） | 苹果侧变化 | 客户端表现 |
|---|---|---|
| 10-12 起 | 拒绝"anisette 是 Android、但 `X-MMe-Client-Info` 声称 Mac"的组合（`GsService2` 返回 `ec -80045 / hsc 500`） | `-80045` |
| 10-14 约 20:50 UTC 起 | 对**任何声明 Android 客户端**的请求直接返回 **503 HTML 页面** | `The data couldn't be read because it isn't in the correct format` |
| 仍然可用 | **Windows ADI（iTunes）身份**的 anisette，由 `ani.jkcoxson.com`、`win.ani.sidestore.io`、`ani2.stikstore.app` 等服务器提供 | 登录正常 |
| 10-13 | SideSign 合并「修复 2FA」提交 → SideStore **nightly 0.7.0-20261013** 起支持苹果新的 2FA 响应 | 解决 `-22411` |
| 10-15 | iLoader 2.3.8 / isideload 0.4.6 采用 Windows 方案（所以**电脑端一直是好的**） | — |

> 另外，**2026-09 还有一次接口变更**：SideStore 官方 `0.7.0-alpha` 的发布说明写着「changes from apple server side which broke **0.6.4 and prior** versions」。
> 所以出现 503 / 格式错误时，除了「身份是 Android」，**还要怀疑「客户端版本 ≤ 0.6.4 太旧」** —— 两个成因当时是先后叠加的。

**推论**：只要客户端身份是 Mac/Android，或客户端的版本/2FA 处理逻辑落后，登录就会失败 —— 与你密码对不对、网络快不快无关。

---

## 8 个真实问题（按遇到顺序）

### ① `The data couldn't be read because it isn't in the correct format`

- **现象**：SideStore 登录页输完账号，报这个（后来又变成 `Failed to Log In`）。
- **判定**：这不是网络断，是**拿到了 HTML 而不是 JSON** —— 苹果边缘节点用 `503` 页面拒绝了你的 anisette 身份（Android/Pixel 那一类）。
- **解决**：把 Anisette 身份换成 **Windows ADI**（见下节「黄金配置」）。
- **验证**：报错变成 `-80045` 或直接进入 2FA，说明身份已被接受。

### ② `kCFErrorDomainCFNetwork -1200`

- **现象**：切成 Wi-Fi 后错误码变了。
- **判定**：`-1200 = kCFURLErrorSecureConnectionFailed`，本机到 **Anisette 服务器**的 TLS 握手建不起来（可能被网络干扰，或服务器已挂）。
- **解决**：换服务器（优先选纯 HTTP 的 `Macley` 或 Windows ADI 类）；确认没有奇怪的 DNS/代理拦截。
- **验证**：报错变成 `-1001`（超时）或直接成功，说明 TLS 这层过了。

### ③ `kCFErrorDomainCFNetwork -1001`（请求超时）

- **现象**：换服务器后变成超时。
- **判定**：选中的服务器**本身不可达/已死**。
- **解决**：实测可达性后再选。本次实测结果：
  - ✅ 可用：`win.ani.sidestore.io`、`ani.jkcoxson.com`、`ani2.stikstore.app`、`ani.sidestore.io`、`ani.sidestore.app/.zip`、`ani.846969.xyz`、`ani.npeg.us`、`anisette.wedotstud.io`、`ani.xu30.top`、`ani.idevicehacked.com`、`ani.jaydenha.uk`、`anisette.crystall1ne.dev`、`omni.ethxn.xyz`、`ani3server.fly.dev`
  - ❌ 超时：`ani.neoarz.com`、`ani.owoellen.rocks`
- **验证**：用 `scripts/test-anisette.mjs` 在你自己的网络下重跑一遍。

### ④ `-80045` / `This action cannot be completed at this time`

- **现象**：密码输完后立刻失败，或者进到 2FA 之前失败。
- **判定**：苹果**拒绝登录本身**，最常见原因是**身份与服务器不配套** —— 客户端 `Client Info` 声明 Windows，而服务器下发的是 Mac/Android 数据。
  （另一种情况：账号被苹果风控，见「不要做的事」。）
- **解决**：
  1. 服务器换成 **Windows ADI** 类；
  2. 确认 `Client Info` 是 Windows 那句；
  3. **关闭**"失败自动轮换服务器"（否则它会自动切回被拒的 Mac 服务器）；
  4. 执行一次「Reset adi.pb / Clear local Anisette provisioning data」（换服务器后旧身份要作废）。
- **验证**：错误码变成 `-22411` 或直接弹出 2FA 提示。

### ⑤ `-22411`（输完密码立刻失败，但手机收到了验证码）

- **现象**：手机弹出「Apple Account Sign In Requested」→ Allow → 验证码也到了，但 App 报错退出。
- **判定**：**这是好消息** —— anisette 已经通过，苹果把 2FA 码主动推给了受信任设备（新响应 `hsc 409`，没有 `au` 字段），是**客户端不认识这个新响应**。
- **解决**：换成**包含 2FA 修复的构建**：
  - ✅ **SideStore nightly ≥ `0.7.0-20261013.1503+12ff39c6`**（本次实测可用）
  - ❌ `0.7.0-20260911`（alpha）、`0.6.4` 及更早、**LC+SS 组合包里内置的 `20260918`** 都不行
  - 校验方法：装完在 App 里看 Settings 底部版本号，或用 `scripts/inspect-ipa.py` 拆 IPA 看内部版本
- **验证**：登录成功（ACCOUNT 显示名字 + Free Developer Account）。

### ⑥ `Pairing Required: No valid pairing file has been loaded`

- **现象**：注册设备/刷新时提示没有配对文件。
- **判定**：iOS 17+ 需要 **rppairing** 格式的配对文件，且必须位于 App 的 `Documents/` 目录。
- **解决**：
  - iLoader 安装时通常会自动放入 → 若没有，在 iLoader 里用「管理配对文件」重新导入；
  - 或在 App 弹出「Pairing File → **Select File**」时，从「文件 → 我的 iPhone → SideStore」里选 `ALTPairingFile.mobiledevicepairing` 完成绑定；
  - 文件格式校验：XML plist，顶层字段 `alt_irk / identifier / private_key / public_key`。
- **验证**：App 偏好里出现 `activePairingProtocol = rppairing`。

### ⑦ `Network Connection Error: No wifi interface satisfied`

- **现象**：点 Continue/Retry 注册设备时报这个。
- **判定**：SideStore 与设备自身通信**必须有 Wi-Fi 接口**（蜂窝网不行）；同时它的回环通道依赖 LocalDevVPN。
- **解决**：① 打开 Wi-Fi 连上任意网络；② 打开 **LocalDevVPN 并连接**（状态栏出现 VPN）；③ 再点 Retry。
- **验证**：日志里出现 `tcpProbe 10.7.0.1:49152 (protocol: .rppairing) -> reachable`（`10.7.0.1` 是 LocalDevVPN 的地址）。

### ⑧ 组合包（LiveContainer + SideStore）里内置的 SideStore 登录困难

- **现象**：独立版 SideStore 能登，但 LiveContainer 里那个内置 SideStore 报同样的错。
- **判定**（本次实测到两条，按可能性排序）：
  1. **配置问题**：它的 `menuAnisetteURL` 可能是 `https://ani.sidestore.app`（Mac/Android 身份），而你填的 `Client Info` 是 Windows → **身份与服务器不匹配** → `-80045`。这条**可以修**（用「黄金配置」改它的偏好即可）。
  2. **版本问题**：组合包内置的 SideStore 版本由 LiveContainer 决定，本次是 **`0.7.0-20260918`（9/18 构建）**，早于 10/13 的 2FA 修复。**若改完配置后仍报 `-22411`**，就是这一条 —— 改配置无效，只能等 LiveContainer 更新内置版本。
- **建议**（更省事也更稳）：
  1. **根本不必登录它**：证书已经由 iLoader 注入在里面（偏好里有 `importedCertificateSerials`、`certMetadata_*`），直接 **LiveContainer → Settings → Import Certificate From Store** 导入即可；
  2. 让**独立版 SideStore**（nightly ≥ 20261013）承担登录、安装、刷新，LiveContainer 只当容器 —— 本文推荐的就是这个架构。

---

## 黄金配置（2026-10 之后照抄）

SideStore → Settings → **User Customizations → Anisette Client Configuration**：

```text
Client Info:  <PC> <Windows;6.2(0,0);9200> <com.apple.AuthKit/1 (com.apple.iTunes/12.12.4.1)>
User Agent:   akd/1.0 CFNetwork/808.1.4
```

Anisette 服务器：选 **Windows ADI** 类（`SideStore (Windows ADI)` ≈ `https://win.ani.sidestore.io`，或 `jkcoxson (Windows ADI)` ≈ `https://ani.jkcoxson.com`），并**关闭自动轮换**。

对应的偏好键（便于脚本核对或远程写入）：

| 键 | 值 |
|---|---|
| `customAnisetteClientInfo` | 上面第一行 |
| `customAnisetteUserAgent` | 上面第二行 |
| `menuAnisetteURL` | `https://win.ani.sidestore.io` |
| `disableAnisetteRotation` | `true` |

**为什么必须手动设**：`SideStore 0.7.0-20261013` 的二进制里编译进去的默认身份仍是 `<MacBookPro18,3> <macOS;26.6>`（实测搜索 `Windows;6.2` 命中 0 次）。官方 PR 计划把默认值改掉，但截至本文尚未合并发版。

---

## 错误码对照表（一张图记住）

| 错误 | 层次 | 一句话 |
|---|---|---|
| `503` / `isn't in the correct format` | 身份层 | 客户端身份是 Android → 换 Windows |
| `-1200` | 网络层 | TLS 建不起来 → 换服务器/查网络 |
| `-1001` | 网络层 | 服务器超时 → 换可达的服务器 |
| `-80045` | 认证层 | 身份与服务器不匹配（或账号被风控）→ 配套 + 停手 |
| `-22411` | 客户端层 | 缺 2FA 新响应支持 → 换 ≥20261013 的构建 |
| `No valid pairing file` | 设备层 | 缺 rppairing 文件 → 放入 `Documents/` |
| `No wifi interface satisfied` | 设备层 | 没 Wi-Fi 接口 → 开 Wi-Fi + LocalDevVPN |

---

## 诊断顺序（照着走，别乱试）

```text
登录失败
 ├─ 报错里带 503 / "correct format" ？ → 改 Windows 身份（黄金配置）
 ├─ 报错是 -1200 / -1001 ？          → 换 Anisette 服务器（先跑 scripts/test-anisette.mjs）
 ├─ 报错是 -80045 ？                 → 服务器与身份配套 + 关自动轮换 + 重置 adi.pb + 停手 2 分钟
 ├─ 报错是 -22411 ？                 → 版本问题：换 SideStore nightly ≥ 0.7.0-20261013（改配置无效）
 ├─ 卡在配对文件 ？                  → 放入 ALTPairingFile.mobiledevicepairing 并在 App 里选一次
 └─ 卡在 Wi-Fi ？                    → 开 Wi-Fi + LocalDevVPN，再 Retry
```

**最有效的确诊手段**：读 App 自己的日志。SideStore 把运行日志写在容器的 `Documents/ConsoleLogs/console_*.log`，里面会写明：用了哪个 anisette 服务器、苹果返回的原始错误码、配对探测结果、设备注册结果。怎么看：见 [05 · 用 USB 操作 iPhone](05-go-ios-usb.md)。

---

## 不要做的三件事

1. **不要连续狂点登录**：苹果会限流（`429/503`），反复失败还可能触发账号保护。失败一次就停 2-3 分钟。
2. **不要用主力 Apple ID**：官方明确建议侧载用**专用小号** —— 多人共用 anisette 服务器时，苹果可能锁定账号。
3. **不要指望降级 iOS**：苹果早已停止签名旧版本；TrollStore 所需的 ≤17.0 已无法通过降级获得。

## 附：顺手会遇到的"假故障"

| 提示 | 是否要紧 | 说明 |
|---|---|---|
| `Failed to update sources on launch. The request timed out.` | ❌ 不要紧 | 拉应用目录时连不上 GitHub，不影响签名与安装 |
| App 图标变灰 / 打不开 | ✅ 要紧 | 签名过期 → 连 Wi-Fi + LocalDevVPN 后刷新 |
| 刷新到 90% 卡住 | 通常自愈 | 回到桌面等几秒；仍失败则重启 App 重试 |
