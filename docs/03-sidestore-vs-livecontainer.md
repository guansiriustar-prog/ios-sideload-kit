# 03 · SideStore 与 LiveContainer 怎么选

> 结论先给：**两个不是竞争关系，是"商店"和"容器"的关系。**
> 简单用 → 只用 SideStore；要装很多 → SideStore + LiveContainer。

## 一句话分工

| | 它是什么 | 类比 |
|---|---|---|
| **SideStore** | 手机端的侧载**商店**：登录 Apple ID、签名、安装、续签 | 应用商店 + 签名工具 |
| **LiveContainer** | App **容器**：把 App 装进它自己内部运行，不占系统签名名额 | 虚拟机 / 沙盒 |

它们的关系：**SideStore 负责"签"，LiveContainer 负责"装得多"**。LiveContainer 自己也需要被签名（被 SideStore 或电脑端 iLoader 装进去），并且需要**借用同一张证书**才能往里装 App。

---

## 对比表

| 维度 | 只用 SideStore | SideStore + LiveContainer |
|---|---|---|
| **同时能装几个 App** | 免费账号上限 **3 个**（含 SideStore 自己 → 你实际还有 2 个） | SideStore 1 个名额 + LiveContainer 占 1 个名额 → 内部**不限数量** |
| **上手难度** | ⭐ 简单：装完登录就能用 | ⭐⭐⭐ 多一步"导入证书"，且要理解容器概念 |
| **稳定性** | ⭐⭐⭐ 官方流程，出问题最少 | ⭐⭐ 多一层容器，个别 App 闪退/检测 |
| **推送通知** | ✅ 正常 | ❌ 容器内的 App **收不到推送** |
| **后台行为** | ✅ 正常 | ⚠️ 需要 LiveContainer 保活，部分 App 后台受限 |
| **App 更新** | SideStore 内直接更新 | 需手动导入新 IPA |
| **JIT（模拟器）** | 配合 StikDebug 可用 | 容器内需额外配置（LiveContainer 自带 JIT 支持） |
| **多开同一 App** | ❌ | ✅ 可复制多份 |
| **7 天续签** | My Apps 下拉刷新 | 同上（额外刷 LiveContainer 自己那份） |
| **占用的账号资源** | 1 个 App ID 名额 | 2 个 App 名额（SideStore + LiveContainer） |

---

## 决策树

```text
你需要装几个"自签 App"（不算 SideStore 自己）？
 ├─ 1~2 个（微信双开、某个模拟器、一两个修改版）
 │    → 只用 SideStore，最简单，别折腾容器
 ├─ 3 个以上，但都是"能独立安装"的 App
 │    → SideStore + LiveContainer（容器内不限数量）
 └─ 要装模拟器、需要 JIT、要多开
      → SideStore + LiveContainer + StikDebug
```

**补充判断**：
- 某个 App **必须收推送**（银行、通讯类）→ 装在 SideStore 里，别放容器。
- 某个 App **有侧载/越狱检测** → 优先试 SideStore 直装；容器环境有时反而更容易被识别。
- 想省名额：把不常用的挪进 LiveContainer。免费账号 3 个名额是硬上限，LiveContainer 只是**绕开**而不是突破。

---

## 名额怎么算（免费 Apple ID）

| 限制 | 数值 | 说明 |
|---|---|---|
| 同时存在的自签 App | **3 个** | 含 SideStore / LiveContainer 本身 |
| 每 7 天可创建的 App ID | **10 个** | 反复重装同一个 App 也会消耗 |
| 签名有效期 | **7 天** | 到期后图标变灰，需刷新（不用重装） |

示例：
- 只装 SideStore → 还能装 2 个 App
- SideStore + LiveContainer → 还能装 1 个 App，容器内随便装
- 有付费开发者账号（$99/年）→ **不再受 3 个 App 限制**、签名 1 年有效；设备注册上限为每平台 100 台

---

## 组合使用的正确姿势（推荐架构）

```text
电脑（一次性，iLoader）
  ├─ 装 SideStore（独立版，nightly ≥ 2026-10-13）  ← 负责登录/签名/刷新
  └─ 装 LiveContainer（独立版，或 LC+SS 组合包）    ← 只当容器

手机
  ├─ SideStore：登录 Apple ID、配置 Anisette、Register Device、刷新
  ├─ LiveContainer：Settings → Import Certificate（从 SideStore 取证书）
  └─ LocalDevVPN：常连（刷新必需）
```

> **关键认知**：LiveContainer **不需要自己登录 Apple ID**。它只需要一张证书 —— 从 SideStore 导入即可。很多人卡在"LC 里那个内置 SideStore 登不上"，其实**根本不用登它**。

---

## 常见误区（都是本次踩过的）

| 误区 | 事实 |
|---|---|
| "LiveContainer 里也要登 Apple ID 才能用" | ❌ 不用。设置里 **Import Certificate From Store** 导入证书即可 |
| "组合包（LC+SS）更省事" | ⚠️ 组合包内置的 SideStore 版本由 LiveContainer 决定，**通常滞后**（本次是 9/18 构建，缺 10/13 的 2FA 修复）。要么先按「黄金配置」排查是不是身份不匹配，要么干脆**不登录它** —— 直接用独立版 SideStore |
| "刷新只是续期，随便点点就行" | ⚠️ 刷新必须 **Wi-Fi + LocalDevVPN** 同时在线，否则失败 |
| "装得多就突破 3 个限制了" | ❌ 系统层面仍是 3 个签名 App；容器内的是"App 里的 App" |
| "容器里的 App 和正常装的一样" | ⚠️ 无推送、无部分系统权限、可能被检测 |

---

## 想删掉 LiveContainer？

可以，随时。**先确认 SideStore 的刷新能跑通**（My Apps 下拉，7 天计数重置），再删除 LiveContainer：
- 长按图标删除即可（它也是普通自签 App）
- ⚠️ 装在它**内部**的 App 会一并消失
- 删除后**释放 1 个名额**，可再装一个独立 App

不删也无害，只是占用 1 个名额。
