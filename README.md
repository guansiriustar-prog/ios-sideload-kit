# iOS 侧载安装包（SideStore / LiveContainer）· 2026 年 10 月实测

> 一份**从零到能用**的中文安装与排错手册，基于 iPhone 15 Pro Max + iOS 26.0.1（A17 Pro）的完整实战记录整理。
> 包含：装机流程、2026 年 10 月苹果接口变更引发的三类登录故障与解法、SideStore 与 LiveContainer 的取舍、机型/版本适配表、以及用 USB 直接操作 iPhone 的自动化脚本。

---

## 目录

| 文档 | 内容 |
|---|---|
| [docs/01-quickstart.md](docs/01-quickstart.md) | 快速开始：电脑侧准备 → 装机 → 登录 → 刷新（照做即可） |
| [docs/02-troubleshooting.md](docs/02-troubleshooting.md) | **踩坑与排错**：8 个真实报错的原因与解决（含错误码对照表） |
| [docs/03-sidestore-vs-livecontainer.md](docs/03-sidestore-vs-livecontainer.md) | 二选一：哪个更好用、更简单、什么情况下必须用哪个 |
| [docs/04-device-support.md](docs/04-device-support.md) | 机型与系统版本适配表（含 TrollStore / 越狱现状对照） |
| [docs/05-go-ios-usb.md](docs/05-go-ios-usb.md) | 进阶：用 go-ios 从电脑 USB 直接读写 App 配置、看日志 |
| [scripts/](scripts) | 可复用脚本：下载校验、Anisette 探针、IPA 版本核查 |
| [SKILL.md](SKILL.md) | 供 AI Agent 加载的技能定义（让 AI 按本手册帮人装） |

---

## 一句话结论

- **只想简单装几个 App** → 只用 **SideStore**（免费 Apple ID，上限 3 个 App，7 天续签一次）。
- **要装很多 App / 模拟器 / 修改版 App** → **SideStore + LiveContainer**（LiveContainer 内不限数量、不占签名名额）。
- **iOS 17.0.1 及以上永远装不了 TrollStore**（苹果已修 CoreTrust 漏洞）；`12/13` 等老机型请走越狱路线，见 [docs/04](docs/04-device-support.md)。

---

## 你能得到什么（能力边界）

| 能做到 | 做不到 |
|---|---|
| 安装任意 IPA（含模拟器、修改版） | 永久签名（免费账号 7 天一轮，付费开发者账号 1 年） |
| 通过 LiveContainer 安装不限数量的 App | 系统级插件 / 改状态栏 / 注入系统进程（需越狱） |
| 不用电脑完成日常续签（配好自动化后） | 突破苹果 3 个 App 的名额限制（LiveContainer 只是绕开，不是突破） |
| 给模拟器开 JIT（配合 StikDebug） | 解除 App 自身的侧载检测 |

---

## 30 秒版流程

```text
电脑（一次性）
  1. 装 iLoader（Windows 需 iTunes 或 Apple 设备驱动）
  2. 手机插线、信任电脑、输入锁屏密码
  3. iLoader 登录 Apple ID → 选「LiveContainer + SideStore」或「导入 IPA」
手机（一次性）
  4. 设置 → 通用 → VPN与设备管理 → 信任开发者 App
  5. 设置 → 隐私与安全性 → 打开「开发者模式」
  6. App Store 装 LocalDevVPN 并连接
  7. SideStore 里配置 Anisette（见下方「关键配置」）→ 登录 Apple ID
  8. 配对文件就位 → 完成「Register Device」
日常（每 7 天）
  9. 连 Wi-Fi + LocalDevVPN → SideStore → My Apps → 下拉刷新
```

---

## 关键配置（2026 年 10 月苹果改接口后**必须**这样设）

SideStore → **Settings → User Customizations → Anisette Client Configuration**：

```text
Client Info:  <PC> <Windows;6.2(0,0);9200> <com.apple.AuthKit/1 (com.apple.iTunes/12.12.4.1)>
User Agent:   akd/1.0 CFNetwork/808.1.4
```

Anisette 服务器选 **Windows ADI** 那一类（`SideStore (Windows ADI)` 或 `jkcoxson (Windows ADI)`），并**关闭**"失败自动轮换服务器"，否则它会切回被苹果拒绝的 Mac/Android 服务器。

> 实测：`win.ani.sidestore.io`、`ani.jkcoxson.com`、`ani2.stikstore.app` 三个服务器的 `/v3/client_info` 返回**完全相同**的 Windows 身份，可互换；`ani.neoarz.com`、`ani.owoellen.rocks` 在实测网络下 10 秒无响应，别选。

---

## 三类登录故障速查（本次踩坑的核心）

| 报错 | 真正含义 | 解决 |
|---|---|---|
| `503` / `The data couldn't be read because it isn't in the correct format` | 苹果**拒绝 Android/Pixel 身份的 anisette**（返回 HTML 错误页而非 JSON）；若客户端 ≤ `0.6.4`，也可能是**版本过旧** | 换成 Windows 身份；并升级到 nightly ≥ `0.7.0-20261013` |
| `-80045` / `This action cannot be completed at this time` | anisette 身份与 `client_info` **不匹配**（例如声称 Windows、服务器却给 Mac 数据） | **服务器与身份配套**（见上文） |
| `-22411`（输完密码立刻出现，手机已收到验证码） | anisette **已通过**，客户端不认识苹果"自动推送 2FA 码"的新响应 | 换 **SideStore nightly ≥ 0.7.0-20261013**（含 SideSign 2FA 修复） |

另有两个**非网络类**的必答题：

| 报错 | 原因 | 解决 |
|---|---|---|
| `Pairing Required: No valid pairing file has been loaded` | App 容器里没有配对文件 | 放入 `ALTPairingFile.mobiledevicepairing`（iOS 17+ 的 rppairing 格式） |
| `Network Connection Error: No wifi interface satisfied` | SideStore 要求**必须有 Wi-Fi 接口**，蜂窝网不行 | 打开 Wi-Fi；**同时**保持 LocalDevVPN 连接 |

完整过程见 [docs/02-troubleshooting.md](docs/02-troubleshooting.md)。

---

## 成分清单（本文用到的工具）

| 工具 | 作用 | 官方来源 |
|---|---|---|
| [iLoader](https://github.com/nab138/iloader) | 电脑端签名安装器（Windows/macOS/Linux），**登录一直是好的**，是保底通道 | GitHub Releases / iloader.app |
| [SideStore](https://github.com/SideStore/SideStore) | 手机端侧载商店（免电脑续签） | GitHub Releases（nightly 通道） |
| [LiveContainer](https://github.com/LiveContainer/LiveContainer) | App 容器：内部不限数量、不占名额 | GitHub Releases |
| [StikDebug](https://github.com/StikDebug/StikDebug) | 给模拟器开 JIT（iOS 17.4+） | GitHub Releases |
| [LocalDevVPN](https://apps.apple.com/app/localdevvpn/id6755608044) | 本地回环 VPN，SideStore 刷新必需 | App Store |
| [go-ios](https://github.com/danielpaulus/go-ios) | 从电脑 USB 操作 iPhone（进阶排错） | GitHub Releases |

`scripts/download.mjs` 会按下面的官方 SHA256 下载并校验（**只信任哈希，不信任镜像**）：

| 文件 | 版本 | SHA256 |
|---|---|---|
| iLoader (Windows) | 2.3.8 | `efcd2fae…ab4def` |
| LiveContainer+SideStore | 3.8.0 | `97dc0fd2…662425` |
| SideStore nightly（含 2FA 修复） | 0.7.0-20261013 | `b082a52e…35d4ac` |
| StikDebug | 3.1.15 | `060cbf92…970039` |
| go-ios (Windows) | 1.3.2 | `939c6bca…dff3fe` |

（脚本内为完整哈希；版本更新时请以 GitHub 官方 Release 页的 digest 为准。）

---

## 免责声明

- 侧载会削弱 iOS 的安全边界；**请只安装你有权使用的 App**。
- 免费 Apple ID 签名 7 天过期属苹果限制，非故障；反复失败登录可能触发苹果风控，**不要连续重试**。
- 建议侧载使用**专用小号 Apple ID**，不要用主力账号。
- 本文档为社区经验整理，与 Apple / SideStore / LiveContainer 官方无隶属关系；按此操作的风险由使用者自负。

## 许可

MIT，见 [LICENSE](LICENSE)。
