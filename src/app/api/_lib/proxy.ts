// src/app/api/_lib/proxy.ts
export const API_BASE_URL = (process.env.API_BASE_URL || "https://database-system.ytrc.co.th/api").replace(/\/+$/, "");

function isJsonContentType(ct?: string | null) {
    return !!ct && ct.toLowerCase().includes("application/json");
}

export async function proxy(req: Request, pathname: string) {
    const url = new URL(req.url);
    const target = `${API_BASE_URL}${pathname}${url.search || ""}`;

    const headers = new Headers();
    // forward only safe headers
    const ct = req.headers.get("content-type");
    if (ct) headers.set("content-type", ct);
    headers.set("accept", "application/json");

    const init: RequestInit = {
        method: req.method,
        headers,
        // body เฉพาะ non-GET/HEAD
        body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
        // ไม่ส่ง credentials ข้ามโดเมน
        cache: "no-store",
        redirect: "manual",
    };

    const resp = await fetch(target, init);

    // อ่านเป็น text เพื่อ passthrough
    const text = await resp.text();

    // set content-type กลับให้ถูก
    const respHeaders = new Headers();
    const respCT = resp.headers.get("content-type");
    respHeaders.set("content-type", isJsonContentType(respCT) ? respCT! : "application/json; charset=utf-8");

    // เผื่อดาวน์โหลดไฟล์ในอนาคต
    const disp = resp.headers.get("content-disposition");
    if (disp) respHeaders.set("content-disposition", disp);

    return new Response(text, { status: resp.status, headers: respHeaders });
}