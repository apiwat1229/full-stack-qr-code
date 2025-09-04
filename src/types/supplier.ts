// src/types/supplier.ts

/* ---------- Rubber Type ---------- */
export type RubberTypeObj = {
    _id: string;
    name: string;
    status?: "active" | "inactive" | string;
};

// API อาจส่งมาเป็น string ของชื่อ หรือเป็น object populate
export type RubberTypeRef = string | RubberTypeObj;

/** type guard: เป็น object ที่มี name */
export function isRubberTypeObj(x: RubberTypeRef): x is RubberTypeObj {
    return typeof x === "object" && x !== null && "name" in x;
}

/** helper: แปลง RubberTypeRef[] => string[] (ชื่อ) */
export function normalizeRubberTypeNames(list?: RubberTypeRef[]): string[] {
    if (!Array.isArray(list)) return [];
    return list
        .map((x) => (typeof x === "string" ? x : x?.name))
        .filter((s): s is string => !!s && typeof s === "string");
}

/* ---------- Supplier ---------- */
export interface Supplier {
    _id: string;
    supCode: string;

    title?:
    | ""
    | "นาย"
    | "นาง"
    | "นางสาว"
    | "ว่าที่ ร.ต."
    | "บริษัท"
    | "หจก."
    | "สหกรณ์";
    firstName: string;
    lastName: string;

    address: string;

    provinceCode?: number | null;
    districtCode?: number | null;
    subdistrictCode?: number | null;
    postalCode?: number | null;

    phone?: string;
    certificateNo?: string;
    certificateExpiry?: string; // "YYYY-MM-DD"

    status?: "Active" | "Suspend" | "Blacklist";

    /** API คืนมาเป็น object[] (populate) แต่กันเหนียวรองรับ string[] ด้วย */
    rubberTypes?: RubberTypeRef[];

    score?: number | null;
    ussEudrQuota?: number | null;
    clEudrQuota?: number | null;

    note?: string;
    avatar?: string;
    background?: string;

    createdAt?: string;
    updatedAt?: string;
    __v?: number;
}