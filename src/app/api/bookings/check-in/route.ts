// src/app/api/bookings/check-in/route.ts
import { proxy } from "../../_lib/proxy";

export async function POST(req: Request) {
    return proxy(req, "/bookings/check-in");
}