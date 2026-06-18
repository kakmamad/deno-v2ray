import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const USER_UUID = "7c9e663a-62a2-4a02-a1f9-4d6d390a3c9e"; 
const WS_PATH = "/secure-edge-stream-99";

// لیست آی‌پی‌های تمیز و زنده کلودفلر/دنو
const DENO_IP_POOL = [
  "151.101.1.6",
  "151.101.2.132",
  "151.101.65.121",
  "151.101.13.13",
  "151.101.193.121",
  "151.101.129.121"
];

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const host = url.hostname;

  if (url.pathname === "/sub") {
    // ساخت مستقیم کانفیگ‌ها بدون درگیر کردن دیتابیس خطاساز
    const configs = DENO_IP_POOL.map((ip, index) => 
      `vless://${USER_UUID}@${ip}:443?encryption=none&security=tls&sni=${host}&type=ws&host=${host}&path=${encodeURIComponent(WS_PATH)}#Deno-Edge-${index + 1}`
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
