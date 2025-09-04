"use client";

import useSWR from "swr";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL &&
        process.env.NEXT_PUBLIC_API_BASE_URL !== ""
        ? process.env.NEXT_PUBLIC_API_BASE_URL
        : "/api";

const fetcher = (url: string) =>
    fetch(`${API_BASE}${url}`, { cache: "no-store" }).then(async (r) => {
        const text = await r.text();
        try {
            return JSON.parse(text);
        } catch {
            throw new Error(text || `HTTP ${r.status}`);
        }
    });

type FlatRow = {
    id: number | string;
    provinceCode: number | string;
    provinceNameTh: string;
    provinceNameEn?: string;
    districtCode: number | string;
    districtNameTh: string;
    districtNameEn?: string;
    subdistrictCode: number | string;
    subdistrictNameTh: string;
    subdistrictNameEn?: string;
    postalCode?: number | string;
};

type ResolveArgs = {
    provinceCode?: string | number | null;
    districtCode?: string | number | null;
    subdistrictCode?: string | number | null;
    postalCode?: string | number | null;
};

export function useThaiAddressApi(args: ResolveArgs) {
    const p = args.provinceCode ? String(args.provinceCode) : "";
    const d = args.districtCode ? String(args.districtCode) : "";
    const s = args.subdistrictCode ? String(args.subdistrictCode) : "";
    const z = args.postalCode ? String(args.postalCode) : "";

    // เรียก flat ก่อน (รองรับ subdistrictCode แล้ว)
    const qs = [
        p && `provinceCode=${encodeURIComponent(p)}`,
        d && `districtCode=${encodeURIComponent(d)}`,
        s && `subdistrictCode=${encodeURIComponent(s)}`,
        z && `postalCode=${encodeURIComponent(z)}`,
    ]
        .filter(Boolean)
        .join("&");

    const { data: flat, error: flatErr, isLoading: loadingFlat } = useSWR<FlatRow[]>(
        `/locations/flat?${qs}`,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 60_000 }
    );

    // fallback (กรณี flat ไม่ได้ข้อมูล)
    const { data: provinces } = useSWR<any[]>(
        flat && flat.length ? null : `/locations/provinces`,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 60_000 }
    );
    const { data: districts } = useSWR<any[]>(
        flat && flat.length ? null : (p ? `/locations/districts?provinceCode=${encodeURIComponent(p)}` : null),
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 60_000 }
    );
    const { data: subdistricts } = useSWR<any[]>(
        flat && flat.length ? null : (d ? `/locations/subdistricts?districtCode=${encodeURIComponent(d)}` : null),
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 60_000 }
    );

    // รวมผล
    let provinceName: string | undefined;
    let districtName: string | undefined;
    let subdistrictName: string | undefined;
    let postal: string | undefined;

    if (flat && flat.length) {
        const row = s ? flat.find((r) => String(r.subdistrictCode) === s) || flat[0] : flat[0];
        provinceName = row?.provinceNameTh;
        districtName = row?.districtNameTh;
        subdistrictName = row?.subdistrictNameTh;
        postal = (args.postalCode as any) || (row?.postalCode as any);
    } else {
        if (provinces && p) {
            provinceName = provinces.find((x) => String(x._id) === p)?.nameTh;
        }
        if (districts && d) {
            districtName = districts.find((x) => String(x._id) === d)?.nameTh;
        }
        if (subdistricts && s) {
            const sd = subdistricts.find((x) => String(x._id) === s);
            subdistrictName = sd?.nameTh;
            postal = (args.postalCode as any) || (sd?.postalCode ? String(sd.postalCode) : undefined);
        }
    }

    // Fallback เมื่อยังหาไม่เจอ
    const province = provinceName || (p ? `จ.${p}` : undefined);
    const district = districtName || (d ? `อ.${d}` : undefined);
    const subdistrict = subdistrictName || (s ? `ต.${s}` : undefined);

    const fullAddress = [subdistrict, district, province, postal].filter(Boolean).join(", ");

    return {
        loading: loadingFlat,
        error: flatErr,
        provinceName: province,
        districtName: district,
        subdistrictName: subdistrict,
        postalCode: postal,
        fullAddress, // ต./อ./จ./ไปรษณีย์ ที่แปลงเป็นชื่อแล้ว
    };
}