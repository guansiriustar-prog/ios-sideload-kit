#!/usr/bin/env node
/**
 * 下载 iOS 侧载所需组件，并逐一校验 SHA256。
 *
 * 用法:
 *   node download.mjs [输出目录]          # 默认 ./downloads
 *   KIT_DOWNLOAD_DIR=D:\ios node download.mjs
 *
 * 校验策略：
 *   - 固定版本（msi / 3.8.0 / StikDebug 等）：使用下面写死的官方 digest；
 *   - 滚动通道（nightly）：运行时先问 GitHub API 要当次构建的 digest，
 *     取不到时退回下面这个「已实测可用」的固定值（会打印提示）。
 *
 * 已存在且校验通过的文件会自动跳过（可反复运行做断点续传 / 完整性复查）。
 * 说明：用 Node 自带的 OpenSSL 栈下载，不依赖 Windows schannel，在受限环境下比 PowerShell/curl 更可靠。
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const OUT_ROOT = resolve(process.argv[2] || process.env.KIT_DOWNLOAD_DIR || './downloads');

/** 版本更新时：从各项目 GitHub Release 页面（或 API 的 assets[].digest）复制新的哈希 */
const ITEMS = [
  {
    name: 'iLoader v2.3.8 (Windows x64 MSI)',
    url: 'https://github.com/nab138/iloader/releases/download/v2.3.8/iloader-windows-x64.msi',
    out: join(OUT_ROOT, 'pc', 'iloader-windows-x64-2.3.8.msi'),
    sha256: 'efcd2fae0087c23f5d5bd87c38e2b28e82d07c58f3ce3b79bbf45ebc4cab4def',
  },
  {
    name: 'go-ios v1.3.2 (Windows，USB 排错用)',
    url: 'https://github.com/danielpaulus/go-ios/releases/download/v1.3.2/go-ios-win.zip',
    out: join(OUT_ROOT, 'pc', 'go-ios-win-v1.3.2.zip'),
    sha256: '939c6bcaafed183a92afb9f79cc11b1f935fa6389bfc94d3902e3f52c4dff3fe',
  },
  {
    name: 'LiveContainer + SideStore 3.8.0（稳定版）',
    url: 'https://github.com/LiveContainer/LiveContainer/releases/download/3.8.0/LiveContainer%2BSideStore.ipa',
    out: join(OUT_ROOT, 'ipa', 'LiveContainer+SideStore-3.8.0.ipa'),
    sha256: '97dc0fd2202fd4460efcab389943b8d5fdbb4988efff76b116b92b84a4662425',
  },
  {
    name: 'SideStore nightly（含 2FA 修复，滚动更新）',
    url: 'https://github.com/SideStore/SideStore/releases/download/nightly/SideStore.ipa',
    out: join(OUT_ROOT, 'ipa', 'SideStore-nightly.ipa'),
    rolling: { repo: 'SideStore/SideStore', tag: 'nightly', asset: 'SideStore.ipa' },
    // 兜底值：2026-10-13 构建，实测可完成登录（含 SideSign 2FA 修复）
    sha256: 'b082a52e2b1949200caeaba9a72767004a99c850b5bcbe964b6edf076535d4ac',
  },
  {
    name: 'StikDebug 3.1.15（JIT，可选）',
    url: 'https://github.com/StikDebug/StikDebug/releases/download/3.1.15/StikDebug-3.1.15.ipa',
    out: join(OUT_ROOT, 'ipa', 'StikDebug-3.1.15.ipa'),
    sha256: '060cbf9287be8e5ebacb45f31f7ce5e81ec9538f971c521badd9cefa4a970039',
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 滚动通道：从 GitHub API 取当次构建的 digest（形如 "sha256:abcd…"） */
async function resolveRollingDigest(item) {
  const { repo, tag, asset } = item.rolling;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ios-sideload-kit' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rel = await res.json();
    const found = (rel.assets || []).find((a) => a.name === asset);
    const digest = found?.digest?.replace(/^sha256:/, '');
    if (digest) {
      console.log(`[滚动通道] ${repo}@${tag} 当前 digest: ${digest}`);
      console.log(`           构建于 ${rel.published_at || rel.created_at}`);
      return digest;
    }
    console.log('[滚动通道] API 未提供 digest，改用固定兜底值');
  } catch (err) {
    console.log(`[滚动通道] 取 digest 失败（${err.message}），改用固定兜底值`);
  }
  return item.sha256;
}

async function sha256Of(file) {
  try {
    return createHash('sha256').update(await readFile(file)).digest('hex');
  } catch {
    return null;
  }
}

async function downloadWithRetry(item, attempts = 5) {
  await mkdir(dirname(item.out), { recursive: true });
  for (let n = 1; n <= attempts; n++) {
    try {
      process.stdout.write(`\n[下载] ${item.name}（第 ${n}/${attempts} 次）\n  ${item.url}\n`);
      const res = await fetch(item.url, { redirect: 'follow', signal: AbortSignal.timeout(900000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const digest = createHash('sha256').update(buf).digest('hex');
      if (item.sha256 && digest !== item.sha256) throw new Error(`SHA256 不匹配: ${digest}`);
      await writeFile(item.out, buf);
      console.log(`  ✅ ${buf.length.toLocaleString('en-US')} 字节`);
      console.log(`     SHA256 ${digest}`);
      return true;
    } catch (err) {
      console.log(`  失败: ${err.message}`);
      if (n < attempts) await sleep(2000 * n);
    }
  }
  console.log(`  ❌ ${item.name} 重试 ${attempts} 次仍未成功`);
  return false;
}

console.log(`输出目录: ${OUT_ROOT}`);

// 先解析滚动通道的期望哈希
for (const item of ITEMS) {
  if (item.rolling) item.sha256 = await resolveRollingDigest(item);
}

const failed = [];
for (const item of ITEMS) {
  if (item.sha256 && (await sha256Of(item.out)) === item.sha256) {
    console.log(`[跳过] ${item.name}（已存在且校验通过）`);
    continue;
  }
  if (!(await downloadWithRetry(item))) failed.push(item.name);
}

console.log('\n===== 汇总 =====');
for (const item of ITEMS) {
  let size = 0;
  try {
    size = (await stat(item.out)).size;
  } catch {
    /* 缺失 */
  }
  const digest = await sha256Of(item.out);
  const ok = digest && (!item.sha256 || digest === item.sha256);
  console.log(`${ok ? 'OK  ' : 'BAD '} ${String(size).padStart(10)} 字节  ${item.out}`);
}
console.log(failed.length ? `\n有 ${failed.length} 项未成功: ${failed.join(', ')}` : '\n全部下载并校验通过。');
process.exit(failed.length ? 1 : 0);
