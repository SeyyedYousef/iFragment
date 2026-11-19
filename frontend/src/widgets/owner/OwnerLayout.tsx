import { A } from '@solidjs/router';
import type { Component, JSX } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { TonIcon } from '@/shared/ui/fragment/FragmentPrimitives.js';
import { ImpersonationBanner } from './ImpersonationBanner.js';
import { type OwnerTabId, OwnerTabs } from './OwnerTabs.js';

interface OwnerLayoutProps {
	children: JSX.Element;
	activeTab: OwnerTabId;
	title?: string;
}

export const OwnerLayout: Component<OwnerLayoutProps> = (props) => {
	return (
		<div class="min-h-screen frag-canvas text-white relative font-frag-sans">
			<ImpersonationBanner />

			{/* Fragment Admin Header (.frag-header) */}
			<header class="frag-header sticky top-0 z-40 px-4 md:px-6 h-[52px] flex items-center justify-between gap-3">
				<div class="flex items-center gap-2.5 min-w-0">
					<TonIcon size={20} color="#4db2ff" />
					<div class="flex items-center gap-2 min-w-0">
						<h1 class="text-[15px] font-bold tracking-[0.02em] text-white truncate">
							{t('ownerShell.title')}
						</h1>
						<span class="px-2 py-0.5 rounded-[4px] bg-[#5aec8c]/10 text-[10.5px] font-semibold text-[#5aec8c]">
							{t('common.live')}
						</span>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<A
						href="/"
						class="h-8 px-2.5 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-white text-[12px] font-semibold flex items-center gap-1 transition-colors"
					>
						<span class="material-symbols-outlined text-[15px] text-[#4db2ff]">home</span>
						<span class="hidden xs:inline">{t('ownerShell.appHome')}</span>
					</A>

					<button
						type="button"
						onClick={() => {
							sessionStorage.removeItem('owner_token');
							sessionStorage.removeItem('owner_telegram_id');
							window.location.href = `${window.location.pathname}#/`;
							window.location.reload();
						}}
						class="h-8 px-2.5 rounded-[6px] bg-[#ff5863]/10 hover:bg-[#ff5863]/20 text-[#ff5863] text-[12px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
						title={t('ownerChrome.logoutTooltip' as any)}
					>
						<span class="material-symbols-outlined text-[15px]">logout</span>
						<span class="hidden xs:inline">{t('ownerShell.exitAdmin')}</span>
					</button>
				</div>
			</header>

			<OwnerTabs active={props.activeTab} />

			<main class="relative z-10 p-4 md:p-6 max-w-6xl mx-auto pb-28">{props.children}</main>
		</div>
	);
};
