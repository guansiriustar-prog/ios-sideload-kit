#!/usr/bin/env node
/**
 * 实测各 Anisette 服务器在【你当前网络】下的可达性，并按响应速度排序。
 *
 * 用途：登录报 -1200（TLS 失败）/ -1001（超时）时，先跑这个，别靠猜。
 * 用法：node test-anisette.mjs
 *
 * 注意：本脚本走的是你电脑的网络。手机若与电脑同一 Wi-Fi，结果可参考；
 *       但手机是否走代理/VPN 会改变结论，最终以手机上的实测为准。
 */
const SERVERS = [
  ['SideStore', 'https://ani.sidestore.io'],
  ['SideStore (.app)', 'https://ani.sidestore.app'],
  ['SideStore (.zip)', 'https://ani.sidestore.zip'],
  ['SideStore (.xyz)', 'https://ani.846969.xyz'],
  ['SideStore (Windows ADI)', 'https://win.ani.sidestore.io'],
  ['jkcoxson (Windows ADI)', 'https://ani.jkcoxson.com'],
  ['stikstore (备选)', 'https://ani2.stikstore.app'],
  ['nythepegasus', 'https://ani.npeg.us'],
  ['Macley（纯 HTTP）', 'http://5.249.163.88:6969'],
  ['WE. Studio', 'https://anisette.wedotstud.io'],
  ['SteX', 'https://ani.xu30.top'],
  ['owoellen', 'https://ani.owoellen.rocks'],
  ['iDH Server', 'https://ani.idevicehacked.com'],
  ['neoarz', 'https://ani.neoarz.com'],
  ['pythonplayer123', 'https://ani3server.fly.dev'],
  ["Jayden's Server", 'https://ani.jaydenha.uk'],
  ["crystall1nedev's server", 'https://anisette.crystall1ne.dev'],
  ["ethxn's omnisette", 'https://omni.ethxn.xyz'],
];

async function probe(name, url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'anisette-probe' },
    });
    return { name, url, ok: true, status: res.status, ms: Date.now() - t0, body: (await res.text()).slice(0, 80).replace(/\s+/g, ' ') };
  } catch (err) {
    return { name, url, ok: false, ms: Date.now() - t0, error: `${err.message} (${err.cause?.code || err.cause?.message || ''})` };
  }
}

const results = await Promise.all(SERVERS.map(([n, u]) => probe(n, u)));
const good = results.filter((r) => r.ok).sort((a, b) => a.ms - b.ms);
const bad = results.filter((r) => !r.ok).sort((a, b) => a.name.localeCompare(b.name));

console.log('===== 可达（优先选 Windows ADI 类）=====');
for (const r of good) {
  console.log(`✅ ${r.name.padEnd(26)} ${String(r.ms).padStart(6)}ms  HTTP ${r.status}  ${r.url}`);
  if (r.body) console.log(`     响应: ${r.body}`);
}
console.log('\n===== 不可达（别选，会报 -1001/-1200）=====');
for (const r of bad) console.log(`❌ ${r.name.padEnd(26)} ${String(r.ms).padStart(6)}ms  ${r.error}  ${r.url}`);
console.log(`\n合计 ${good.length}/${results.length} 个可达`);
