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
				url: '/admin/user-list',   // → http://localhost:4560/admin/user-list
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
				id: 'checkout-checked',
				title: 'Weight Out',
				type: 'item',
				icon: 'lucide:log-out',
				url: '/check-out/checked',
				end: true,
			},
			{
				id: 'checkin-history',
				title: 'Booking History',
				type: 'item',
				icon: 'lucide:archive',
				url: '/check-in/history',
				end: true,
			},
		],
	},
];

export default navigationConfig;