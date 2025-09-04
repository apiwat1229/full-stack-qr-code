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

export type UserRow = {
    _id: string;
    email?: string;
    role?: string;
    username?: string;
    department?: string;
    name?: string;
    lastName?: string;
    permission?: Partial<Permission>;
    permissions?: Partial<Permission>;
    hod?: {
        _id?: string;
        email?: string;
        role?: string;
        username?: string;
        name?: string;
        lastName?: string;
        id?: string;
    } | null;
    mustChangePassword?: boolean;
    createdAt?: string;
    updatedAt?: string;
    passwordChangedAt?: string;
};

export function getMyPerms(session: any): Permission {
    // ปรับตามโครง session จริงของคุณได้
    const p = (session?.user as any)?.permission || {};
    return { ...defaultPerms, ...p };
}