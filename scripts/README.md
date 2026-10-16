# scripts · 可复用脚本

五个小工具，覆盖"下载 → 校验 → 诊断"三件事。全部只用 **Node.js 内置模块** 或 **Python 标准库**，无需 `npm install` / `pip install`。

| 脚本 | 用途 | 依赖 |
|---|---|---|
| `download.mjs` | 按官方 SHA256 下载 iLoader / SideStore / LiveContainer / StikDebug / go-ios | Node 18+ |
| `fetch-goios.mjs` | GitHub CDN 不稳时，走镜像下载 go-ios 并用官方哈希校验 | Node 18+ |
| `test-anisette.mjs` | 实测 18 个 Anisette 服务器在你网络下的可达性与延迟 | Node 18+ |
| `get-client-info.mjs` | 取服务器声明的 `client_info` / `user_agent`（手机上要照抄这两个值） | Node 18+ |
| `inspect-ipa.py` | 拆开 IPA，列出内部所有 App/框架版本（判断是否含 2FA 修复） | Python 3.8+ |

## 常用命令

```bash
# 下载全部组件到 ./downloads（已存在且校验通过会自动跳过）
node download.mjs
node download.mjs D:\ios-kit          # 或指定输出目录

# go-ios 直连失败时
node fetch-goios.mjs

# 登录报 -1200 / -1001 时，先看看哪台服务器是活的
node test-anisette.mjs

# 手机上的 Anisette 配置该填什么（照抄输出）
node get-client-info.mjs

# 核查某个 IPA 里装的 SideStore 是什么版本
python inspect-ipa.py SideStore-nightly-0.7.0-20261013.ipa
```

## 为什么坚持校验 SHA256

这些文件的来源渠道很多（镜像、网盘、群里转发），**只有哈希不会骗人**：
只要 SHA256 与 GitHub Release 页公布的 `digest` 一致，文件就与官方原版逐字节相同，从哪个镜像下的都无所谓。
