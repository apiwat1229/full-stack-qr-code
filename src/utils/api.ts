import ky, { KyInstance } from 'ky';

// 1. ดึงค่า API URL จากไฟล์ .env โดยตรง
//    - ถ้าหาเจอใน .env.local หรือ .env จะใช้ค่านั้น
//    - ถ้าหาไม่เจอเลย จะใช้ค่าสำรองสำหรับ development คือ http://localhost:4005/api
const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4005/api';

let globalHeaders: Record<string, string> = {};

export const api: KyInstance = ky.create({
	// 2. ใช้ API_URL ที่ได้มาเป็น prefixUrl โดยตรง ไม่ต้องต่อ "/api" ซ้ำ
	prefixUrl: API_URL,
	hooks: {
		beforeRequest: [
			(request) => {
				Object.entries(globalHeaders).forEach(([key, value]) => {
					request.headers.set(key, value);
				});
			}
		]
	},
	retry: {
		limit: 2,
		methods: ['get', 'put', 'head', 'delete', 'options', 'trace']
	}
});

// --- ส่วนที่เหลือของไฟล์เหมือนเดิม ---

export const setGlobalHeaders = (headers: Record<string, string>) => {
	globalHeaders = { ...globalHeaders, ...headers };
};

export const removeGlobalHeaders = (headerKeys: string[]) => {
	headerKeys.forEach((key) => {
		delete globalHeaders[key];
	});
};

export const getGlobalHeaders = () => {
	return globalHeaders;
};

export default api;