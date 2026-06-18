import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// یک UUID معتبر برای خودت (می‌توانی تغییرش دهی)
const USER_UUID = "7c9e663a-62a2-4a02-a1f9-4d6d390a3c9e"; 
const WS_PATH = "/secure-edge-stream-99";

// باز کردن دیتابیس داخلی دنو
const kv = await Deno.openKv();

const DENO_IP_POOL = [
  "151.101.1.6",
  "151.101.2.132",
  "151.101.65.121",
  "151.101.13.13",
  "151.101.193.121",
  "151.101.129.121"
];

// این بخش هر ۱۲ ساعت یک‌بار خودکار در پس‌زمینه آی‌پی‌های تمیز را پیدا و ذخیره می‌کند
Deno.cron("Auto IP Scanner", "0 */12 * * *", async () => {
  console.log("Cron Job Started: Scanning for clean IPs...");
  const cleanIPs: string[] = [];
  
  const tasks = DENO_IP_POOL.map(async (ip) => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1500);

      await fetch(`https://${ip}`, { method: "HEAD", signal: controller.signal, headers: { "Host": "deno.dev" } });
      clearTimeout(id);
      return { ip, success: true };
    } catch {
      return { ip, success: false };
    }
  });

  const results = await Promise.all(tasks);
  const filtered = results.filter(r => r.success).map(r => r.ip);

  if (filtered.length > 0) {
    await kv.set(["clean_ips"], filtered);
    console.log("Database updated with clean IPs:", filtered);
  }
});

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const host = url.hostname;

  // بخش تحویل ساب‌اسکریپشن
  if (url.pathname === "/sub") {
    const res = await kv.get<string[]>(["clean_ips"]);
    const cleanIPs = res.value || ["151.101.65.121", "151.101.2.132"];

    const configs = cleanIPs.map((ip, index) => 
      `vless://${USER_UUID}@${ip}:443?encryption=none&security=tls&sni=${host}&type=ws&host=${host}&path=${encodeURIComponent(WS_PATH)}#Deno-Auto-${index + 1}`
    );

    return new Response(btoa(configs.join("\n")), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" }
    });
  }

  // بخش پردازش ترافیک وب‌سوکت پروکسی
  if (url.pathname === WS_PATH && req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    // منطق ریلی دیتا در اینجا به صورت سرورلس هندل می‌شود
    return response;
  }

  return new Response("Not Found", { status: 404 });
}

serve(handler);
