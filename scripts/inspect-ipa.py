#!/usr/bin/env python3
"""拆开 .ipa，列出内部所有 App / 框架的标识符与版本号。

用途：
  - 确认 SideStore IPA 里打包的是哪个构建（判断是否含 2FA 修复，需 >= 0.7.0-20261013）
  - 确认组合包（LiveContainer + SideStore）里内嵌的 SideStore 版本

用法:
  python inspect-ipa.py <某个.ipa>
"""
import plistlib
import re
import sys
import zipfile

# Windows 中文控制台默认 GBK，遇到非 GBK 字符会崩；这里强制 UTF-8
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# SideStore 版本形如 0.7.0-20261013.1503+12ff39c6；取其中的日期段做数值比较
FIX_DATE = 20261013  # SideSign 2FA 修复并入 nightly 的构建日期


def build_date(version: str) -> int:
    m = re.search(r"(\d{8})", version)
    return int(m.group(1)) if m else 0


def classify(path: str, bid: str) -> str:
    """按 Info.plist 所在路径判断它是什么，避免把插件/扩展/嵌套依赖误当成主 App。"""
    if re.match(r"^Payload/[^/]+\.app/Info\.plist$", path):
        return "主 App"
    if path.endswith("Frameworks/SideStoreApp.framework/Info.plist"):
        return "内嵌 SideStore"
    if "SideStoreApp.framework/" in path:
        return "内嵌依赖"
    if ".appex/" in path or "PlugIns/" in path:
        return "扩展"
    if "Frameworks/" in path:
        return "框架"
    if ".bundle/" in path:
        return "资源包"
    return "其它"


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    path = sys.argv[1]
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        plists = [n for n in names if n.endswith("Info.plist")]

        print(f"文件: {path}")
        print(f"条目数: {len(names)}   Info.plist: {len(plists)}\n")

        rows = []
        for n in plists:
            try:
                d = plistlib.loads(z.read(n))
            except Exception:
                continue
            bid = d.get("CFBundleIdentifier")
            if not bid:
                continue
            rows.append(
                {
                    "kind": classify(n, bid),
                    "bid": bid,
                    "short": str(d.get("CFBundleShortVersionString", "?")),
                    "build": str(d.get("CFBundleVersion", "?")),
                    "minos": str(d.get("MinimumOSVersion", "?")),
                    "exe": d.get("CFBundleExecutable", "?"),
                    "path": n,
                }
            )

        rows.sort(key=lambda r: (r["kind"], r["bid"]))
        for r in rows:
            print(f"[{r['kind']}] {r['bid']}")
            print(f"    版本 {r['short']} (build {r['build']})  最低系统 iOS {r['minos']}  可执行 {r['exe']}")
            print(f"    {r['path']}")

        # 针对性结论
        print("\n===== 结论 =====")
        for r in rows:
            if r["kind"] == "内嵌 SideStore" or (
                r["kind"] == "主 App" and r["bid"].startswith("com.SideStore.SideStore")
            ):
                d = build_date(r["short"])
                tag = "内嵌" if r["kind"] == "内嵌 SideStore" else "内置"
                if d == 0:
                    print(f"[?] {tag} SideStore {r['short']}：无法从版本号判断构建日期，请人工核对")
                elif d >= FIX_DATE:
                    print(f"[OK] {tag} SideStore {r['short']}：含 2FA 修复（可正常登录）")
                else:
                    print(f"[!] {tag} SideStore {r['short']}：早于 {FIX_DATE}，缺 2FA 修复，登录可能报 -22411")
            if r["kind"] == "主 App" and r["bid"].startswith("com.kdt.livecontainer"):
                print(f"[i] LiveContainer {r['short']}（容器本体）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
