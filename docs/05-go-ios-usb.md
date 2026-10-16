# 05 · 进阶：用 USB 从电脑直接操作 iPhone（go-ios）

> 用途：**排错时不想靠用户口述报错**，而是直接从电脑读 App 的配置文件、运行日志，甚至远程修改配置。
> 工具：[go-ios](https://github.com/danielpaulus/go-ios)（跨平台，单文件 CLI）。本文基于 `v1.3.2` Windows 版实测。

---

## 1. 准备

```powershell
# 从官方 Release 下载 go-ios-win.zip 并解压，得到 ios.exe
# 校验 SHA256（示例值，请以官方 Release 页 digest 为准）
#   939c6bcaafed183a92afb9f79cc11b1f935fa6389bfc94d3902e3f52c4dff3fe

# 关键：用「用户态隧道」，不需要管理员权限、不需要 wintun 驱动
$env:ENABLE_GO_IOS_AGENT = 'user'
.\ios.exe tunnel start --userspace     # 后台常驻，别关
.\ios.exe tunnel ls                    # 看到 userspaceTun: true 即成功
```

> 不加 `--userspace` 会要求管理员权限（`this program needs elevated privileges`）。
> iOS 17+ 的多数命令都需要这条隧道；隧道依赖 Apple Mobile Device Service（Windows 上由 iTunes/Apple 设备驱动提供）。

## 2. 常用命令

```powershell
.\ios.exe list                          # 列出设备 UDID
.\ios.exe info                          # 设备信息（系统版本、芯片等）
.\ios.exe apps                          # 已装 App + 容器路径（JSON）
.\ios.exe ps                            # 进程列表
.\ios.exe kill  <bundleID>              # 结束 App
.\ios.exe launch <bundleID>             # 启动 App
.\ios.exe screenshot out.png            # 截屏
```

## 3. 文件读写（`fsync` = house_arrest AFC，**不需要 DDI**）

```powershell
# 列目录
.\ios.exe fsync tree --app=<bundleID> --path=/Documents

# 下载到本机（--dstPath 必须是【目录】！文件会按原名落入该目录）
.\ios.exe fsync pull --app=<bundleID> --srcPath=/Documents/config.json --dstPath=D:\dump

# 上传到设备
.\ios.exe fsync push --app=<bundleID> --srcPath=D:\dump\config.json --dstPath=/Documents/config.json

# 删除 / 建目录
.\ios.exe fsync rm   --app=<bundleID> --path=/Documents/old.json
.\ios.exe fsync mkdir --app=<bundleID> --path=/Documents/newdir
```

### 三个必须知道的坑

1. **`pull` 的 `--dstPath` 是目录**。传文件名不会报错，但会**建出一个同名目录**并把文件塞进去（表现为"1 字节的文件"）。
2. **`ios file …` 需要开发者磁盘映像（DDI）**，会报 `service 'com.apple.coredevice.fileservice.control' is not available in RSD`；改用 `fsync` 即可绕过，代价是不支持 `--app-group`。
3. **路径语义按 App 而异**：
   - 普通 App（如 SideStore）：`/Documents/...`、`/Library/Preferences/<bundleID>.plist`
   - **LiveContainer 会把访客容器重定向**：它的内置 SideStore 数据在 **`/Documents/SideStore/`**，例如偏好文件
     `/Documents/SideStore/Library/Preferences/com.SideStore.SideStore.plist`，配对文件 `/Documents/SideStore/Documents/ALTPairingFile.mobiledevicepairing`

## 4. 远程改配置（绕过手机 UI 手打长字符串）

```powershell
# 1) 先结束进程，避免内存态覆盖磁盘
.\ios.exe kill <bundleID>

# 2) 拉出 UserDefaults
.\ios.exe fsync pull --app=<bundleID> `
  --srcPath=/Library/Preferences/<bundleID>.plist --dstPath=D:\dump

# 3) 用 Python 改键（务必写回二进制 plist）
python -c "import plistlib;d=plistlib.load(open(r'D:\dump\<bundleID>.plist','rb'));d['menuAnisetteURL']='https://win.ani.sidestore.io';d['disableAnisetteRotation']=True;plistlib.dump(d,open(r'D:\dump\new.plist','wb'),fmt=plistlib.FMT_BINARY)"

# 4) 推回 + 回读校验 + 重启 App
.\ios.exe fsync push --app=<bundleID> --srcPath=D:\dump\new.plist --dstPath=/Library/Preferences/<bundleID>.plist
.\ios.exe fsync pull --app=<bundleID> --srcPath=/Library/Preferences/<bundleID>.plist --dstPath=D:\verify
.\ios.exe launch <bundleID>
```

常用 SideStore 偏好键：

| 键 | 作用 | 本次使用值 |
|---|---|---|
| `customAnisetteClientInfo` | anisette 客户端身份 | `<PC> <Windows;6.2(0,0);9200> <com.apple.AuthKit/1 (com.apple.iTunes/12.12.4.1)>` |
| `customAnisetteUserAgent` | 对应 UA | `akd/1.0 CFNetwork/808.1.4` |
| `menuAnisetteURL` | 当前 anisette 服务器 | `https://win.ani.sidestore.io` |
| `disableAnisetteRotation` | 禁止失败后自动换服务器 | `true` |
| `activePairingProtocol` | 配对协议（导入配对文件后由 App 写入） | `rppairing` |
| `importedCertificateSerials` | 已导入的证书序列号 | 由 iLoader 注入 |

## 5. 读 App 日志（最有效的确诊手段）

SideStore 会把运行日志写到容器的 `Documents/ConsoleLogs/console_*.log`：

```powershell
.\ios.exe fsync tree --app=<bundleID> --path=/Documents/ConsoleLogs
.\ios.exe fsync pull --app=<bundleID> --srcPath=/Documents/ConsoleLogs/console_20261016_171317_524.log --dstPath=D:\logs
Select-String -Path D:\logs\console_*.log -Pattern 'anisette|pairing|fetchUDID|Register|error'
```

成功时你会看到类似：

```text
[minimuxer] [iface] tcpProbe 10.7.0.1:49152 (protocol: .rppairing) -> reachable
[SideStore] fetchUDID() completed
[OnDeviceAnisetteManager] [Fetch] SUCCESS: AnisetteData generated successfully.
[DeviceRegistrationFlow] Device '<设备名>' (UDID: <...>) is registered on team.
```

失败时则能直接看到苹果返回的原始错误码（`-80045` / `503` / `hsc 409` 等）—— 比界面上的提示精确得多。

## 6. 配对文件从哪来

iLoader 在 Windows 上会把 iOS 17+ 的配对记录存进**凭据管理器**，条目标签形如 `rppairing1.1_file_<UDID>.iloader`（内容是 501 字节左右的 XML plist，字段 `alt_irk / identifier / private_key / public_key`）。

取出后可写入目标 App 的 `Documents/ALTPairingFile.mobiledevicepairing`，再在 App 内点一次 **Select File** 完成绑定（之后 App 会自己写入 `activePairingProtocol`）。

## 7. 能力边界（别抱幻想）

- ❌ **无法注入触摸/点击**：iOS 没有开放给外部的触摸注入。唯一的正规途径是 WebDriverAgent，而它需要**用同一张开发者证书签名**，私钥只存在于手机钥匙串里 → 死循环。
- ❌ `ios ax`（辅助功能通道）实测会挂起，不要依赖。
- ❌ 无法读取 App 的**钥匙串**（证书私钥在里面）。
- ✅ 能做的：读写 App 沙盒文件、启动/结束 App、截屏、看日志、装包（需已签名）、查看设备信息。
