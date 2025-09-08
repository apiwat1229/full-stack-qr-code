// src/types/user.ts

/* ---------- Permission ---------- */
export type Permission = {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
    approve: boolean;
    // ออปชันเสริมที่บางระบบมี
    checkin?: boolean;
};

export const defaultPerms: Permission = {
    create: true,
    read: true,
    update: true,
    delete: false,
    approve: false,
};

/* ---------- UserRow ---------- */
/** โครงผู้ใช้หลัก: บังคับให้มี `id` เสมอ (จะ normalize จาก `_id` ให้) */
export type UserRow = {
    /** ใช้ตัวนี้เป็นหลัก (normalize จาก id/_id/ObjectId) */
    id: string;
    /** เผื่อ API บางจุดยังส่ง _id มา */
    _id?: string;

    email?: string;
    role?: "user" | "staff" | "admin" | string;
    username?: string;
    department?: string;
    /** ตำแหน่งงาน เช่น "Manager" */
    position?: string;
    name?: string;
    lastName?: string;

    // รองรับชื่อคีย์ permissions ที่หลากหลายจาก API/หน้าเก่า
    permission?: Partial<Permission>;
    permissions?: Partial<Permission>;
    perms?: Partial<Permission>;

    hod?: {
        id?: string;
        _id?: string;
        email?: string;
        role?: "user" | "staff" | "admin" | string;
        username?: string;
        name?: string;
        lastName?: string;
    } | null;

    mustChangePassword?: boolean;
    createdAt?: string;
    updatedAt?: string;
    passwordChangedAt?: string;
};

/* ---------- Helpers (ID / Normalize) ---------- */

/** แปลงค่าเป็น string id อย่างปลอดภัย (รองรับ ObjectId, number, string) */
function toIdString(v: unknown): string {
    if (!v) return "";
    // รองรับ Mongoose ObjectId
    // @ts-ignore
    if (typeof v === "object" && v !== null && typeof (v as any).toHexString === "function") {
        // @ts-ignore
        return String((v as any).toHexString());
    }
    // รองรับมี toString()
    if (typeof (v as any)?.toString === "function") {
        return String((v as any).toString());
    }
    // number / string ธรรมดา
    return typeof v === "string" || typeof v === "number" ? String(v) : "";
}

/** คืน id string จากวัตถุที่มี id/_id (ไม่ throw) */
export function pickId(x: { id?: any; _id?: any } | null | undefined): string {
    if (!x) return "";
    const id = toIdString((x as any).id);
    if (id) return id;
    const oid = toIdString((x as any)._id);
    return oid || "";
}

/** แปลงรายการผู้ใช้ให้มี `id` เสมอ และจัดรูป hod.id ให้เรียบร้อย */
export function normalizeUsers<T extends Record<string, any>>(arr: T[] | undefined | null): UserRow[] {
    return (arr ?? []).map((u) => normalizeUser(u)!) as UserRow[];
}

/** แปลงผู้ใช้เดี่ยวให้มี `id` เสมอ (ถ้าหา id ไม่เจอ จะให้เป็น string ว่าง) */
export function normalizeUser<T extends Record<string, any>>(u: T | undefined | null): UserRow | null {
    if (!u) return null;

    const id =
        pickId(u as any) ||
        // fallback เพิ่มเติม (กันกรณีฝั่ง API ใส่ property แปลก)
        toIdString((u as any)._id ?? (u as any).id);

    const rawHod = (u as any).hod ?? null;
    const hod =
        rawHod && typeof rawHod === "object"
            ? {
                ...rawHod,
                id: pickId(rawHod) || toIdString((rawHod as any)._id ?? (rawHod as any).id),
            }
            : null;

    return {
        ...(u as any),
        id,
        hod,
    } as UserRow;
}

/* ---------- Permission extractor ---------- */
/** ดึงสิทธิ์จาก session/user ให้เป็นก้อนเดียว พร้อมเติมค่า default */
export function getMyPerms(session: any): Permission {
    const u = session?.user ?? {};
    const p =
        (u.permission as Partial<Permission> | undefined) ??
        (u.permissions as Partial<Permission> | undefined) ??
        (u.perms as Partial<Permission> | undefined) ??
        {};
    return { ...defaultPerms, ...p };
}

/* ---------- Type guards / Utils เพิ่มเติม ---------- */

/** true ถ้าเป็นผู้ใช้ (ไม่ใช่ null/undefined) */
export function hasUser(u: UserRow | null | undefined): u is UserRow {
    return !!u && typeof u === "object";
}

/** ดึง hod id จาก user (รองรับหลายรูปแบบ) */
export function getHodId(u: Partial<UserRow> | any): string {
    const raw = (u?.hod as any) ?? null;
    return (
        pickId({ id: u?.hodId ?? u?.managerId, _id: undefined }) ||
        (raw ? pickId(raw) : "")
    );
}