// src/app/api/bookings/lookup/route.ts
import { proxy } from "../../_lib/proxy";

export async function GET(req: Request) {
    // ฝั่ง upstream รับที่ /bookings/lookup?booking_code=...
    return proxy(req, "/bookings/lookup");
}