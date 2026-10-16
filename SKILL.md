---
name: ios-sideload-helper
description: 'Use when someone wants to install or repair SideStore / LiveContainer / StikDebug on an iPhone or iPad, or hits sideloading failures: Apple ID sign-in errors (503, -80045, -22411), "The data couldn''t be read because it isn''t in the correct format", "No valid pairing file has been loaded", "No wifi interface satisfied", expired free-account apps, or asks whether TrollStore is possible on their iOS version. Covers iOS 15-26 with a free Apple ID, on Windows/macOS/Linux hosts.'
---

# iOS 侧载助手（SideStore / LiveContainer）

用**免费 Apple ID** 帮用户把侧载环境装起来并排错。本技能基于 2026-10 苹果接口变更期间的完整实战记录（iPhone 15 Pro Max + iOS 26.0.1 实测通过）。

## 先做三个判定，再动手

1. **用户要什么？**
   - 只要装少量 App（≤2 个自装）→ **只装 SideStore**
   - 要装很多 / 模拟器 / 修改版 → **SideStore + LiveContainer**
   - 问 TrollStore → 见「TrollStore 口径」，**不要**引导用户降级（苹果早已停止签名旧版）
2. **系统版本？**
   - SideStore / LiveContainer：iOS 15.0+（实测 26.0.1 通过）
   - StikDebug（JIT）：iOS 17.4+
3. **电脑系统？** Windows 需装 iTunes 或 Apple 设备驱动（usbmuxd）；macOS 自带；Linux 需 usbmuxd。

## 安装主流程

1. **电脑侧**：装 [iLoader](https://github.com/nab138/iloader)（唯一官方来源：iloader.app 或 GitHub Releases）→ 手机插线 → 手机上「信任此电脑」+ 输入锁屏密码 → iLoader 登录 Apple ID → 选 `LiveContainer + SideStore`（或 `导入 IPA` 选 SideStore nightly）。
2. **手机侧信任**：设置 → 通用 → VPN 与设备管理 → 信任开发者 App → 重启；设置 → 隐私与安全性 → 打开**开发者模式**。
3. **装 LocalDevVPN**（App Store）并**连接**——SideStore 刷新/安装期间必须保持连接。
4. **配置 Anisette（关键，2026-10 之后必做）**：Settings → User Customizations → Anisette Client Configuration：
   ```text
   Client Info:  <PC> <Windows;6.2(0,0);9200> <com.apple.AuthKit/1 (com.apple.iTunes/12.12.4.1)>
   User Agent:   akd/1.0 CFNetwork/808.1.4
   ```
   Anisette 服务器选带 **Windows ADI** 字样的那一项，并**关闭自动轮换服务器**。
5. **登录**：输入 Apple ID/密码 → 手机弹「Apple Account Sign In Requested」→ Allow → 验证码**必须用受信任设备生成**（设置 → 你的名字 → 登录与安全 → 获取验证码；短信验证码在苹果侧已失效）。
6. **配对文件**：iOS 17+ 需要 `ALTPairingFile.mobiledevicepairing` 出现在 App 的 `Documents/`。iLoader 会自动放入；否则让 App 里点 `Select File` 选中它。
7. **设备注册**：Settings 里若有黄色警告，点 Continue 完成「Register Device」（**必须连 Wi-Fi**）。
8. **日常续签**：Wi-Fi + LocalDevVPN → SideStore → My Apps → 下拉刷新；可做成快捷指令（动作名 **`Refresh All Apps`**，后台静默运行，建议每 6 天一次 + 「立即运行」）。

## 报错 → 处理（照表执行，不要瞎试）

| 症状 | 判定 | 处理 |
|---|---|---|
| `isn't in the correct format` / 响应是 HTML `503` | 苹果拒绝 **Android/Pixel 身份** | 改成上面的 Windows 身份 |
| `-80045` | anisette 身份与服务器**不匹配** | 服务器与身份配套：客户端声明 Windows，服务器就必须给 Windows ADI 数据 |
| `-22411`（密码后立刻，验证码已到手机） | anisette 已通过，**客户端缺 2FA 新响应处理** | 用 SideStore **nightly ≥ 0.7.0-20261013**；旧构建（如 LC+SS 3.8.0 内置的 0.6.4 / 20260918）必然失败 |
| `Pairing Required: No valid pairing file has been loaded` | 容器缺配对文件 | 放入 `ALTPairingFile.mobiledevicepairing`（rppairing，字段 `alt_irk/identifier/private_key/public_key`） |
| `Network Connection Error: No wifi interface satisfied` | 无 Wi-Fi 接口 | 打开 Wi-Fi；`10.7.0.1` 探测不通则说明 LocalDevVPN 没连 |
| 反复失败 | 苹果风控 | **停止重试**（会触发限流甚至锁号），隔 2-3 分钟或换网络/账号 |
| `Failed to update sources…timed out` | 拉应用目录超时（GitHub 不可达） | 无害，不影响签名与安装 |

**不要**做的三件事：① 不要引导用户降级 iOS（早已停签）；② 不建议用主力 Apple ID（官方明确建议小号，共享 anisette 服务器有锁号风险）；③ 不要在登录失败时连续狂点（会 429/503）。

## 版本与名额（必须向用户交代清楚）

- 免费 Apple ID：**同时最多 3 个 App**（含 SideStore 自己）、**每 7 天 10 个 App ID**、签名 **7 天**过期。
- 想要更多 App：装进 **LiveContainer**（不占名额），但需从 SideStore 导入一次证书，且容器内 App **无推送**。
- TrollStore：**仅 ≤ iOS 17.0**；17.0.1+ 永远不会支持（CoreTrust 已修）。TrollStore Lite 需越狱，越狱现状见仓库 `docs/04-device-support.md`。

## 用 USB 深排（可选，Windows/Linux/macOS 通用）

仓库自带说明与脚本：

```powershell
$env:ENABLE_GO_IOS_AGENT = 'user'          # 用户态隧道，无需管理员
& .\ios.exe tunnel start --userspace
& .\ios.exe apps                            # 看 App 与容器路径
& .\ios.exe fsync tree  --app=<bundleID> --path=/Documents
& .\ios.exe fsync pull  --app=<bundleID> --srcPath=<设备路径> --dstPath=<本机目录>
& .\ios.exe fsync push  --app=<bundleID> --srcPath=<本机文件> --dstPath=<设备路径>
& .\ios.exe kill <bundleID>; & .\ios.exe launch <bundleID>
```

要点：
- `fsync pull` 的 `--dstPath` 必须是**目录**（文件按原名落入），传文件名会建出同名目录。
- **LiveContainer 的 `/Documents` 读不到**（它把访客容器重定向了）：它的内置 SideStore 数据在 `/Documents/SideStore/`（偏好文件 `/Documents/SideStore/Library/Preferences/com.SideStore.SideStore.plist`）。
- 直接改偏好：先 `kill` App → `pull` plist → 改键 → `push` 回 → 回读校验 → `launch`。
- 诊断优先读 App 自己的日志：SideStore 写在 `Documents/ConsoleLogs/console_*.log`，里面会写明用了哪个 anisette 服务器、苹果返回的原始错误码。
- 想在电脑侧改 App 的 `UserDefaults` 前，**先结束进程**，否则内存态会覆盖磁盘。

## 交付要求

- 每一步都告诉用户**当前该点哪里、成功标志是什么**，不要一次抛 10 步。
- 明确区分「配置问题」和「版本问题」：`-80045` 可当场修，`-22411` 需要换构建。
- 结束前确认三件事：① 能刷新（7 天计数重置）② 能装 App ③ 知道过期后怎么续。
