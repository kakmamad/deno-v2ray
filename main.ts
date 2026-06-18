import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const USER_UUID = "7c9e663a-62a2-4a02-a1f9-4d6d390a3c9e"; 
const WS_PATH = "/secure-edge-stream-99";

const kv = await Deno.openKv();

const DENO_IP_POOL = [
  "151.101.1.6",
  "151.101.2.132",
  "151.101.65.121",
  "151.101.13.13",
  "151.101.193.121",
  "151.101.129.121"
];

// تابع تست زنده بودن آی‌پی‌ها
async function scanAndGetIPs(): Promise<string[]> {
  const tasks = DENO_IP_POOL.map(async (ip) => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1200);
      await fetch(`https://${ip}`, { method: "HEAD", signal: controller.signal, headers: { "Host": "deno.dev" } });
      clearTimeout(id);
      return { ip, success: true };
    } catch {
      return { ip, success: false };
    }
  });

  const results = await Promise.all(tasks);
  const filtered = results.filter(r => r.success).map(r => r.ip);
  return filtered.length > 0 ? filtered : ["151.101.65.121", "151.101.2.132"];
}

// کرون‌جاب ۱2 ساعته در پس‌زمینه
Deno.cron("Auto IP Scanner", "0 */12 * * *", async () => {
  const filtered = await scanAndGetIPs();
  await kv.set(["clean_ips"], filtered);
});

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const host = url.hostname;

  if (url.pathname === "/sub") {
    const res = await kv.get<string[]>(["clean_ips"]);
    let cleanIPs = res.value;

    // ترفند اصلی: اگر بار اول دیتابیس خالی بود، درجا خودش اسکن کند و منتظر کرون‌جاب نماند
    if (!cleanIPs || cleanIPs.length === 0) {
      cleanIPs = await scanAndGetIPs();
      await kv.set(["clean_ips"], cleanIPs); 
    }

    const configs = cleanIPs.map((ip, index) => 
      `vless://${USER_UUID}@${ip}:443?encryption=none&security=tls&sni=${host}&type=ws&host=${host}&path=${encodeURIComponent(WS_PATH)}#Deno-Auto-${index + 1}`
    );

    return new Response(btoa(configs.join("\n")), {
      status: 200,
      headers: { 
        "Content-Type": "text/plain; charset=utf-8", 
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store"
      }
    });
  }

  if (url.pathname === WS_PATH && req.headers.get("upgrade") === "websocket") {
    const { response } = Deno.upgradeWebSocket(req);
    return response;
  }

  return new Response("Deno Edge Active", { status: 200 });
}

serve(handler);
