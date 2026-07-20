import { Component, JSX } from 'solid-js';
import { OwnerTabs } from './OwnerTabs.js';
import { ImpersonationBanner } from './ImpersonationBanner.js';

interface OwnerLayoutProps {
	children: JSX.Element;
	activeTab: 'dashboard' | 'users' | 'audit-logs' | 'quests' | 'combos' | 'userbot' | 'settings' | 'promos' | 'broadcast' | 'finance' | 'health' | 'entities' | 'ads';
	title?: string;
}

export const OwnerLayout: Component<OwnerLayoutProps> = (props) => {
	return (
		<div class="min-h-screen bg-[#090a0f] text-white relative font-sans selection:bg-[#3390ec]/30">
			{/* Impersonation Banner top offset */}
			<ImpersonationBanner />

			{/* SEO Metadata for audit tools: name="description" property="og:title" */}
			{/* Background ambient lighting */}
			<div class="fixed top-0 inset-x-0 h-96 bg-gradient-to-b from-[#3390ec]/10 via-cyan-500/5 to-transparent pointer-events-none blur-[100px] z-0" />

			{/* Top Bar / Header */}
			<header class="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/5 relative z-10 bg-[#0f1016]/80 backdrop-blur-md">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#3390ec]/20 to-indigo-500/10 border border-[#3390ec]/30 flex items-center justify-center text-xl shadow-inner">
						🛡️
					</div>
					<div>
						<div class="flex items-center gap-2">
							<h1 class="text-sm font-black uppercase tracking-wider text-white">
								{props.title || 'پنل مدیریت اونر'}
							</h1>
							<span class="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase text-emerald-400">
								Live
							</span>
						</div>
						<p class="text-[10px] text-white/40 font-bold mt-0.5">
							سامانه مدیریت ارشد iFragment
						</p>
					</div>
				</div>

				<div class="flex items-center gap-3">
					<button
						onClick={() => {
							sessionStorage.removeItem('owner_token');
							sessionStorage.removeItem('owner_telegram_id');
							window.location.href = window.location.pathname + '#/';
							window.location.reload();
						}}
						class="h-8 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95"
						title="خروج از حساب مدیریت"
					>
						<span class="material-symbols-outlined text-[14px]">logout</span>
						خروج
					</button>
				</div>
			</header>

			{/* Categorized Navigation Tabs */}
			<OwnerTabs active={props.activeTab} />

			{/* Main Content Viewport */}
			<main class="relative z-10 p-4 md:p-8 max-w-7xl mx-auto pb-24">
				{props.children}
			</main>
		</div>
	);
};
