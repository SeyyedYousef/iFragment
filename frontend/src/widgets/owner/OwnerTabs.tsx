import { useNavigate } from '@solidjs/router';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

interface OwnerTabsProps {
	active: 'dashboard' | 'users' | 'audit-logs' | 'quests';
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
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 ${
					props.active === 'dashboard'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">dashboard</span>
				{t('owner.tabs.overview')}
			</button>

			<button
				onClick={() => handleNav('/owner/users')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 ${
					props.active === 'users'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">group</span>
				{t('owner.tabs.users')}
			</button>

			<button
				onClick={() => handleNav('/owner/audit-logs')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 ${
					props.active === 'audit-logs'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">receipt_long</span>
				{t('owner.tabs.auditLogs')}
			</button>

			<button
				onClick={() => handleNav('/owner/quests')}
				class={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 ${
					props.active === 'quests'
						? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/15'
						: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
				}`}
			>
				<span class="material-symbols-outlined text-[14px]">task</span>
				{t('owner.tabs.quests')}
			</button>
		</div>
	);
};
