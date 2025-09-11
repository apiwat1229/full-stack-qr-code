import { FuseNavItemType } from '@fuse/core/FuseNavigation/types/FuseNavItemType';
import i18n from '@i18n';
import ar from './navigation-i18n/ar';
import en from './navigation-i18n/en';
import tr from './navigation-i18n/tr';

i18n.addResourceBundle('en', 'navigation', en);
i18n.addResourceBundle('tr', 'navigation', tr);
i18n.addResourceBundle('ar', 'navigation', ar);

const navigationConfig: FuseNavItemType[] = [
	// ✅ Admin (ด้านบนสุด)
	{
		id: 'admin',
		title: 'Admin',
		type: 'group',
		icon: 'lucide:shield-check',
		children: [
			{
				id: 'users',
				title: 'Users Management',
				type: 'item',
				icon: 'lucide:user-cog',
				url: '/admin/user-list', // → http://localhost:4560/admin/user-list
				end: true,
			},
		],
	},

	{
		id: 'about-me',
		title: 'About Me',
		type: 'item',
		icon: 'lucide:info',
		url: '/about-me',
		end: true,
	},

	{
		id: 'booking',
		title: 'Booking',
		type: 'group',
		icon: 'lucide:calendar-days',
		children: [
			{
				id: 'booking-queue',
				title: 'Booking Queue',
				type: 'item',
				icon: 'lucide:list',
				url: '/booking',
				end: true,
			},
		],
	},

	{
		id: 'suppliers',
		title: 'Suppliers',
		type: 'group',
		icon: 'lucide:users',
		children: [
			{
				id: 'supplier-list',
				title: 'Supplier',
				type: 'item',
				icon: 'lucide:user-plus',
				url: '/suppliers/list',
				end: true,
			},
		],
	},

	{
		id: 'truck-scale',
		title: 'Truck Scale',
		type: 'group',
		icon: 'lucide:truck',
		children: [
			{
				id: 'dashboard-truck-scale',
				title: 'Dashboard',
				type: 'item',
				icon: 'lucide:chart-no-axes-combined',
				url: '/dashboard/received-rubber',
				end: true,
			},
			{
				id: 'checkin',
				title: 'Check In',
				type: 'item',
				icon: 'lucide:log-in',
				url: '/check-in',
				end: true,
			},
			{
				id: 'checkin-checked',
				title: 'Weight In',
				type: 'item',
				icon: 'lucide:scale',
				url: '/check-in/checked',
				end: true,
			},
			{
				id: 'checkout',
				title: 'Weight Out',
				type: 'item',
				icon: 'lucide:log-out',
				url: '/check-out',
				end: true,
			},
		],
	},

	// ✨ เมนูที่เพิ่มเข้ามาใหม่ตามคำขอ ✨
	{
		id: 'raw-material-receiving',
		title: 'Raw Material Receiving',
		type: 'group',
		icon: 'lucide:box',
		children: [
			{
				id: 'cuplump-receive',
				title: 'Cuplump Receive',
				type: 'item',
				icon: 'lucide:boxes',
				url: '/cuplump-received',
				end: true,
			},
		],
	},

	// 🧪 YTRC Data Lab (เมนูใหม่)
	{
		id: 'ytrc-data-lake',
		title: 'YTRC Data Lake',
		type: 'group',
		icon: 'lucide:flask-conical',
		children: [
			{
				id: 'lab-raw-material',
				title: 'Raw Material',
				type: 'item',
				icon: 'lucide:clipboard-pen',
				url: '/data-lake/raw-material',
				end: true,
			},
			{
				id: 'lab-machine',
				title: 'Machine',
				type: 'item',
				icon: 'lucide:cog',
				url: '/data-lake/machine',
				end: true,
			},
			{
				id: 'lab-fg-qc',
				title: 'Environment / FG',
				type: 'item',
				icon: 'lucide:clipboard-list',
				url: '/data-lake/fg-qc',
				end: true,
			},
		],
	},
];

export default navigationConfig;