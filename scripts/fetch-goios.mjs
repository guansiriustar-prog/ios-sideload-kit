#!/usr/bin/env node
/**
 * 通过多个镜像下载 go-ios，并用官方 SHA256 校验完整性。
 * （GitHub Release 的资产 CDN 在部分网络下不稳定，故准备多个镜像；
 *   但只要哈希与官方一致，文件就是原版，与来源无关。）
 *
 * 用法:
 *   node fetch-goios.mjs [输出目录]        # 默认 ./downloads/pc
 */
import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const OUT_DIR = resolve(process.argv[2] || process.env.KIT_DOWNLOAD_DIR || './downloads/pc');
const OUT = join(OUT_DIR, 'go-ios-win-v1.3.2.zip');

// 官方值：api.github.com/repos/danielpaulus/go-ios/releases/latest → assets[].digest
const SHA256 = '939c6bcaafed183a92afb9f79cc11b1f935fa6389bfc94d3902e3f52c4dff3fe';
const OFFICIAL = 'https://github.com/danielpaulus/go-ios/releases/download/v1.3.2/go-ios-win.zip';

const MIRRORS = [
  ['官方直连', OFFICIAL],
  ['ghproxy.net', `https://ghproxy.net/${OFFICIAL}`],
  ['gh-proxy.com', `https://gh-proxy.com/${OFFICIAL}`],
  ['ghfast.top', `https://ghfast.top/${OFFICIAL}`],
  ['gh.llkk.cc', `https://gh.llkk.cc/${OFFICIAL}`],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir(OUT_DIR, { recursive: true });

let saved = false;
for (const [label, url] of MIRRORS) {
  for (let attempt = 1; attempt <= 2 && !saved; attempt++) {
    try {
      console.log(`[${label}] 第 ${attempt} 次 …`);
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(600000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const digest = createHash('sha256').update(buf).digest('hex');
      if (digest !== SHA256) {
        console.log(`  哈希不匹配，丢弃: ${digest}`);
        continue;
      }
      await writeFile(OUT, buf);
      console.log(`  ✅ ${buf.length.toLocaleString('en-US')} 字节，SHA256 与官方一致`);
      saved = true;
    } catch (err) {
      console.log(`  失败: ${err.message} (${err.cause?.code || err.cause?.message || ''})`);
      await sleep(2000);
    }
  }
  if (saved) break;
}
console.log(saved ? `\n已保存到 ${OUT}` : '\n所有镜像都失败，请手动下载并核对 SHA256');
process.exit(saved ? 0 : 1);
