import { A } from '@solidjs/router';
import type { Component, JSX } from 'solid-js';
import { locale, t } from '@/shared/i18n/index.js';
import { ImpersonationBanner } from './ImpersonationBanner.js';
import { type OwnerTabId, OwnerTabs } from './OwnerTabs.js';

interface OwnerLayoutProps {
	children: JSX.Element;
	activeTab: OwnerTabId;
	title?: string;
}

export const OwnerLayout: Component<OwnerLayoutProps> = (props) => {
	const isFa = () => locale() === 'fa';

	return (
		<div class="min-h-screen bg-[#08090e] text-white relative font-sans selection:bg-[#3390ec]/30">
			<ImpersonationBanner />

			{/* Background ambient lighting */}
			<div class="fixed top-0 inset-x-0 h-96 bg-gradient-to-b from-[#3390ec]/10 via-cyan-500/5 to-transparent pointer-events-none blur-[110px] z-0" />

			{/* Top Sovereign Command Header */}
			<header class="px-4 md:px-8 pt-4 pb-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 relative z-10 bg-[#0c0e16]/90 backdrop-blur-xl">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#3390ec]/25 via-cyan-500/15 to-amber-500/10 border border-[#3390ec]/40 flex items-center justify-center text-lg shadow-lg shadow-[#3390ec]/10">
						<span class="material-symbols-outlined text-cyan-400 text-[22px]">
							admin_panel_settings
						</span>
					</div>
					<div>
						<div class="flex items-center gap-2 flex-wrap">
							<h1 class="text-sm md:text-base font-black uppercase tracking-wider text-white">
								{isFa()
									? 'فرماندهی کل پلتفرم (Sovereign Owner Terminal)'
									: 'Sovereign Owner Terminal'}
							</h1>
							<span class="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-black uppercase text-emerald-400 flex items-center gap-1">
								<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
								{t('common.live')}
							</span>
						</div>
						<p class="text-[11px] text-white/45 font-medium mt-0.5">
							{isFa()
								? 'مدیریت یکپارچه موتورهای نام کاربری (@)، شماره‌های کلکسیونی (+888)، گیفت‌های تلگرام، کریدیت ⚡ و نشست‌های MTProto'
								: 'Unified Command for @Usernames, +888 Numbers, Telegram Gifts, Intel Credits ⚡ & MTProto Sessions'}
						</p>
					</div>
				</div>

				{/* Quick Terminal Jumpers & Session Logout */}
				<div class="flex items-center gap-2 flex-wrap">
					<div class="hidden sm:flex items-center gap-1.5 bg-white/[0.03] border border-white/10 rounded-xl p-1">
						<A
							href="/username"
							class="px-2.5 py-1 rounded-lg text-[10px] font-bold text-sky-300 hover:bg-sky-500/15 transition flex items-center gap-1"
						>
							<span>@</span>
							<span>{isFa() ? 'نام کاربری' : 'Usernames'}</span>
						</A>
						<A
							href="/numbers"
							class="px-2.5 py-1 rounded-lg text-[10px] font-bold text-amber-300 hover:bg-amber-500/15 transition flex items-center gap-1"
						>
							<span>+888</span>
							<span>{isFa() ? 'شماره‌ها' : 'Numbers'}</span>
						</A>
						<A
							href="/gifts"
							class="px-2.5 py-1 rounded-lg text-[10px] font-bold text-purple-300 hover:bg-purple-500/15 transition flex items-center gap-1"
						>
							<span>🎁</span>
							<span>{isFa() ? 'گیفت‌ها' : 'Gifts'}</span>
						</A>
					</div>

					<A
						href="/"
						class="h-8 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[10px] font-bold transition flex items-center gap-1"
					>
						<span class="material-symbols-outlined text-[14px]">home</span>
						<span>{isFa() ? 'صفحه اصلی' : 'App Home'}</span>
					</A>

					<button
						type="button"
						onClick={() => {
							sessionStorage.removeItem('owner_token');
							sessionStorage.removeItem('owner_telegram_id');
							window.location.href = `${window.location.pathname}#/`;
							window.location.reload();
						}}
						class="h-8 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95"
						title={t('ownerChrome.logoutTooltip' as any)}
					>
						<span class="material-symbols-outlined text-[14px]">logout</span>
						<span>{isFa() ? 'خروج ادمین' : 'Exit Admin'}</span>
					</button>
				</div>
			</header>

			{/* Categorized Navigation Tabs */}
			<OwnerTabs active={props.activeTab} />

			{/* Main Content Viewport */}
			<main class="relative z-10 p-4 md:p-8 max-w-7xl mx-auto pb-28">{props.children}</main>
		</div>
	);
};
