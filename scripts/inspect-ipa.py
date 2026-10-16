#!/usr/bin/env python3
"""拆开 .ipa，列出内部所有 App / 框架的标识符与版本号。

用途：
  - 确认 SideStore IPA 里打包的是哪个构建（判断是否含 2FA 修复，需 >= 0.7.0-20261013）
  - 确认组合包（LiveContainer + SideStore）里内置的 SideStore 版本

用法:
  python inspect-ipa.py <某个.ipa>
"""
import plistlib
import sys
import zipfile


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
                (
                    bid,
                    str(d.get("CFBundleShortVersionString", "?")),
                    str(d.get("CFBundleVersion", "?")),
                    str(d.get("MinimumOSVersion", "?")),
                    d.get("CFBundleExecutable", "?"),
                    n,
                )
            )

        for bid, short, build, minos, exe, n in sorted(rows):
            print(f"{bid:<48} {short:<26} build={build:<12} iOS>={minos:<6} {exe}")
            print(f"    {n}")

        # 给出针对性的结论
        print()
        for bid, short, *_ in rows:
            if bid.startswith("com.SideStore.SideStore") and "SideStoreApp" not in bid:
                if short >= "0.7.0-20261013":
                    print(f"✅ 内含 SideStore {short}：包含 2FA 修复（可登录）")
                else:
                    print(f"⚠️ 内含 SideStore {short}：早于 0.7.0-20261013，登录可能报 -22411")
            if bid.startswith("com.kdt.livecontainer"):
                print(f"ℹ️ 内含 LiveContainer {short}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
