import { useNavigate } from '@solidjs/router';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component } from 'solid-js';

interface OwnerTabsProps {
	active: 'dashboard' | 'users' | 'audit-logs' | 'quests' | 'combos' | 'userbot' | 'settings' | 'promos' | 'broadcast' | 'finance' | 'health' | 'entities' | 'ads';
}

export const OwnerTabs: Component<OwnerTabsProps> = (props) => {
	const navigate = useNavigate();

	const handleNav = (path: string) => {
		try {
			hapticFeedback.impactOccurred('light');
		} catch {}
		navigate(path);
	};

	return (
		<div class="px-6 py-3 flex gap-2 overflow-x-auto relative z-10 border-b border-white/5 bg-[#0f1016]/40 backdrop-blur-sm select-none">
			<button
				onClick={() => handleNav('/owner/dashboard')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
					props.active === 'dashboard'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">dashboard</span>
				داشبورد
			</button>

			<button
				onClick={() => handleNav('/owner/users')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
					props.active === 'users'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">group</span>
				کاربران
			</button>

			<button
				onClick={() => handleNav('/owner/audit-logs')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
					props.active === 'audit-logs'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">receipt_long</span>
				لاگ‌های سیستم
			</button>

			<button
				onClick={() => handleNav('/owner/promos')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
					props.active === 'promos'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">redeem</span>
				کدهای هدیه
			</button>

			<button
				onClick={() => handleNav('/owner/broadcast')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
					props.active === 'broadcast'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">campaign</span>
				ارسال پیام
			</button>

			<button
				onClick={() => handleNav('/owner/quests')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
					props.active === 'quests'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">task</span>
				مأموریت‌ها
			</button>

			<button
				onClick={() => handleNav('/owner/combos')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
					props.active === 'combos'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">extension</span>
				کامبو روزانه
			</button>
			
			<button
				onClick={() => handleNav('/owner/userbot')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
					props.active === 'userbot'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">smart_toy</span>
				ربات متصل
			</button>
			
			<button
				onClick={() => handleNav('/owner/settings')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
					props.active === 'settings'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">settings</span>
				تنظیمات سیستم
			</button>

			<button
				onClick={() => handleNav('/owner/finance')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
					props.active === 'finance'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">account_balance</span>
				امور مالی
			</button>

			<button
				onClick={() => handleNav('/owner/entities')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
					props.active === 'entities'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">grid_view</span>
				موجودیت‌ها
			</button>

			<button
				onClick={() => handleNav('/owner/health')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
					props.active === 'health'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">monitor_heart</span>
				سلامت سیستم
			</button>



			<button
				onClick={() => handleNav('/owner/ads')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
					props.active === 'ads'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">campaign</span>
				تبلیغات
			</button>
		</div>
	);
};
