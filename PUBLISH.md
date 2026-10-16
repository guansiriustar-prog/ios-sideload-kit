# 发布 / 更新到 GitHub

本目录已经是**可以直接推送**的仓库内容（不含任何个人隐私信息，已脱敏）。安装包不随仓库分发，由 `scripts/download.mjs` 从官方源下载并校验 SHA256。

## 一、首次推送

```bash
cd ios-sideload-kit
git init -b main
git add .
git commit -m "docs: iOS sideload guide (SideStore/LiveContainer) with 2026-10 troubleshooting"

# 方式 A：用已登录的 gh CLI 一步创建并推送（推荐）
gh repo create ios-sideload-kit --public --source=. --remote=origin --push

# 方式 B：手动创建远程后推送
# git remote add origin https://github.com/<你的用户名>/ios-sideload-kit.git
# git push -u origin main
```

把 `--public` 换成 `--private` 即为私有仓库。

> 发布前请替换 [LICENSE](LICENSE) 第 3 行的 `<在此填写你的名字或 GitHub 用户名>` —— 填昵称即可，不必写真名。

## 二、后续更新

```bash
git add .
git commit -m "docs: update ..."
git push
```

## 三、发布前自查（重要）

推送**之前**请确认仓库里没有这些东西：

```bash
# 1) 是否误提交了安装包 / 证书 / 配对文件（.gitignore 已拦截，仍建议确认）
git ls-files | grep -Ei '\.(ipa|msi|p12|mobileprovision|mobiledevicepairing|plist)$'

# 2) 是否残留个人标识（Apple ID、设备 UDID、证书序列号、真名）
git grep -nEi 'apple|icloud|@gmail|@qq|@outlook|udid|[0-9a-f]{40}|[0-9a-f]{8}-[0-9a-f]{4}' -- . ':!scripts'
```

期望结果：只有文档里的**通用示例值**（如 `your-apple-id@example.com`、`<DEVICE_UDID>`）。

## 四、维护建议

| 事项 | 建议 |
|---|---|
| 版本号过时 | 每次苹果改接口 / 工具发新版后，更新 README 的组件表与 `scripts/download.mjs` 里的 SHA256 |
| 新增排错案例 | 追加到 `docs/02-troubleshooting.md`，并在 `SKILL.md` 的对照表里补一行 |
| 组件哈希来源 | 一律取 `https://api.github.com/repos/<owner>/<repo>/releases/latest` 里的 `assets[].digest` |
| 不要提交的东西 | 任何含 Apple ID、UDID、证书、配对文件、日志的内容（`.gitignore` 已覆盖） |

## 五、作为「技能」被 AI 使用

根目录的 `SKILL.md` 采用通用技能格式（YAML frontmatter + Markdown 指令 + 可选 `scripts/`）。
把整个目录放进支持技能的 AI 工具的技能目录（例如 `~/.dsh/skills/ios-sideload-helper/`），
AI 即可在用户提出"装 SideStore / 巨魔 / 侧载报错"时自动加载本手册并按流程执行。
