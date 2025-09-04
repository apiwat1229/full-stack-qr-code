// src/lib/undici-insecure.ts
import { Agent, setGlobalDispatcher } from "undici";

/** ใช้เฉพาะ DEV: ปิด verify TLS เมื่อ env บอกไว้ */
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    try {
        setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }));
    } catch {
        // เงียบ ๆ
    }
}