#!/usr/bin/env node
/**
 * 从 Anisette 服务器取回它声明的 client_info / user_agent。
 *
 * 为什么重要：苹果要求「客户端声明的身份」必须与「服务器下发的 anisette 数据」配套，
 * 否则报 -80045。手机上的 Client Info / User Agent 必须照抄这里返回的值。
 *
 * 用法: node get-client-info.mjs [服务器URL...]
 *   默认检查三个 Windows ADI 服务器。
 */
const SERVERS = process.argv.slice(2);
const LIST = SERVERS.length
  ? SERVERS.map((u) => [u, u])
  : [
      ['jkcoxson (Windows ADI)', 'https://ani.jkcoxson.com'],
      ['SideStore (Windows ADI)', 'https://win.ani.sidestore.io'],
      ['stikstore (备选)', 'https://ani2.stikstore.app'],
    ];

for (const [name, base] of LIST) {
  console.log(`\n===== ${name}  ${base} =====`);
  const url = `${base.replace(/\/$/, '')}/v3/client_info`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    console.log(`  HTTP ${res.status}`);
    try {
      const j = JSON.parse(text);
      console.log(`  Client Info : ${j.client_info ?? '(缺失)'}`);
      console.log(`  User Agent  : ${j.user_agent ?? '(缺失)'}`);
    } catch {
      console.log(`  非 JSON 响应: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.log(`  失败: ${err.message} (${err.cause?.code || ''})`);
  }
}

console.log(`
在手机上这样填（SideStore → Settings → User Customizations → Anisette Client Configuration）：
  Client Info:  <PC> <Windows;6.2(0,0);9200> <com.apple.AuthKit/1 (com.apple.iTunes/12.12.4.1)>
  User Agent:   akd/1.0 CFNetwork/808.1.4
并把 Anisette Server 选成上面响应里带 Windows 身份的那一台，同时关闭"失败自动轮换"。`);
