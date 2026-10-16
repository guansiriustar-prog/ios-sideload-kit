# 01 · 快速开始（从零到能用）

> 面向对象：一台 iPhone/iPad（iOS 15.0 及以上）+ 一台电脑 + 一个**免费** Apple ID。
> 全程约 20 分钟。**推荐顺序照抄，别跳步。**

## 0. 先决条件（缺一不可）

| 项目 | 要求 | 不满足会怎样 |
|---|---|---|
| 锁屏密码 | **必须已设置** | 签名直接失败 |
| Wi-Fi | 手机与电脑都连 Wi-Fi | `No wifi interface satisfied` |
| Apple ID | 免费账号即可；**建议用专用小号** | 主力号有被风控/锁号风险 |
| 电脑驱动 | Windows 需 iTunes 或 Apple 设备驱动 | iLoader 看不到手机 |
| 手机解锁 | 插线时保持解锁并点「信任」 | 无法建立配对 |

---

## 1. 电脑侧：装 iLoader

只有两个官方来源：[iloader.app](https://iloader.app) 或 [GitHub Releases](https://github.com/nab138/iloader/releases)。**不要**从第三方站点下载。

- Windows：下载 `iloader-windows-x64.msi` 双击安装（会弹一次 UAC）
- macOS：`.dmg`
- Linux：`.AppImage` / `.deb` / `.rpm`

> Windows 若 iLoader 检测不到手机：安装 **iTunes / Apple 设备驱动**（提供 usbmuxd）。
> 本次实测中，iCloud 附带的 `Apple Mobile Device Support` 已足够，**无需额外安装 iTunes**；只有检测不到设备时再装。

## 2. 电脑侧：用 iLoader 安装

1. 数据线连接 iPhone → 手机点「**信任此电脑**」→ 输入锁屏密码
2. 打开 iLoader → 右上角应出现你的设备
3. 齿轮 → **Add Account** → 登录 Apple ID（**区分大小写**；双重认证优先用"受信任设备"）
4. 选择要装的东西：
   - 想省名额、要装很多 App → 点 **「LiveContainer + SideStore」**
   - 只想简单用 → 点 **「SideStore」**，或点 **「导入 IPA」** 选择 `SideStore-nightly-<日期>.ipa`
5. 等待出现 **「✅ 签名并安装应用 / 操作完成」**

> iLoader 在安装「SideStore / LC+SS」这类预设目标时会顺带完成两件事：注入签名证书、放入 iOS 17+ 需要的配对文件。
> **但用「导入 IPA」安装其它 App（例如独立版 SideStore）时可能不放配对文件** —— 本次就遇到了，需要手工补齐（见 [02 · 排错](02-troubleshooting.md) 第 ⑥ 条）。

## 3. 手机侧：信任与开发者模式

1. 设置 → 通用 → **VPN 与设备管理** → 「开发者 App」下选你的 Apple ID → **信任** → 允许并重启 → 输入密码
2. 设置 → 隐私与安全性 → 拉到底 → 打开 **开发者模式**（会重启，重启后需再确认一次）

## 4. 手机侧：装 LocalDevVPN 并连接

App Store 搜 **LocalDevVPN**（[直链](https://apps.apple.com/app/localdevvpn/id6755608044)）→ 打开 → **连接**（提示"允许 VPN 配置"时输入密码）。

> 它只是**本地回环 VPN**（不是翻墙工具），但 SideStore 与设备自身通信必须靠它。耗电极低，建议**长期保持连接**。

## 5. 手机侧：Sign in 前的关键配置

SideStore → **Close**（跳过登录页）→ 底部 **Settings** → **User Customizations** → **Anisette Client Configuration**：

```text
Client Info:
<PC> <Windows;6.2(0,0);9200> <com.apple.AuthKit/1 (com.apple.iTunes/12.12.4.1)>

User Agent:
akd/1.0 CFNetwork/808.1.4
```

再进 **Anisette Servers**：选择带 **Windows ADI** 字样的服务器（如 `SideStore (Windows ADI)`），并把"失败自动轮换服务器"**关掉**。

> 为什么必须这样：2026 年 10 月苹果开始拒绝 Mac / Android 身份的 anisette，而 `SideStore 0.7.0-20261013` 这个构建里**编译进去的默认身份仍然是 Mac**，所以必须手动覆盖。

## 6. 登录 Apple ID

登录页输入账号 + **密码** → **Sign in**。

- 手机弹出「**Apple Account Sign In Requested**」→ 点 **Allow**
- 取验证码：**设置 → 你的名字 → 登录与安全 → 获取验证码**（⚠️ **不要**用短信验证码，苹果侧已失效）
- 把 6 位码填入 SideStore

成功标志：**Settings → ACCOUNT** 显示你的名字 + 「Free Developer Account」。

## 7. 配对文件与设备注册

- 若弹出 **「Pairing File → Select File」** → 点 `Select File` → 文件选择器 → **我的 iPhone → SideStore → `ALTPairingFile.mobiledevicepairing`**
  （iLoader 已把它放进容器，你只需选一次完成绑定）
- 若 Settings 里出现黄色警告 **「1 Pending Action → Register Device」** → 点 **Continue**（**必须连着 Wi-Fi**）
- 报 `No wifi interface satisfied` → 回去开 Wi-Fi + 连 LocalDevVPN，再点 Retry

成功标志：黄色警告消失。

## 8. 验证刷新（最重要的一步）

保持 **Wi-Fi + LocalDevVPN 连接** → SideStore → **My Apps** → **下拉刷新**。

成功标志：列表里 SideStore 那行的「还剩 N 天」重置为 **7 DAYS**。

> 这一步没通过之前，不要急着装一堆 App —— 它决定你能否"不用电脑自助续签"。

## 9. 让它自动续签（可选但强烈建议）

1. SideStore → Settings → 「REFRESHING APPS」区域 → 打开 **Allow Siri To Refresh Apps…**
2. 「快捷指令」App → **自动化** → `+` → **特定时间**（建议**每 6 天**一次，例如 21:00）→ 选 **立即运行**（不要选"运行前询问"）→ 添加操作 → 搜 **SideStore** → 选 **`Refresh All Apps`** → 完成
3. 再加一个手动版：新建快捷指令 → 同样动作 → 命名「一键续签」→ 设置 → 辅助功能 → 触控 → **轻点背面** → 双击 → 选它

> `Refresh All Apps` 是 SideStore 提供的系统级动作（`openAppWhenRun: false`），**后台静默运行、不打开 App**。

## 10. 以后每 7 天

```text
连 Wi-Fi + LocalDevVPN → SideStore → My Apps → 下拉刷新
（或敲两下手机背面触发「一键续签」）
```

**不需要电脑**。只有两种情况需要重新插线：App 全部过期太久打不开；配对文件失效（系统升级/重置后偶发）。

---

## 下一步

- 想把 App 数量从 3 个变成「不限」→ 看 [03 · SideStore 与 LiveContainer 怎么选](03-sidestore-vs-livecontainer.md)
- 任何报错 → 直接查 [02 · 踩坑与排错](02-troubleshooting.md)
