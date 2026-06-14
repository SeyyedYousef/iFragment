import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import {
	Component,
	createEffect,
	createSignal,
	For,
	Match,
	onCleanup,
	Show,
	Suspense,
	Switch,
} from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { checkedInToday, currentLeague, userClan } from '@/shared/store/airdrop.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { BoostersView } from './BoostersView.js';
import { ClanView } from './ClanView.js';
import { DailyRewardView } from './DailyRewardView.js';
import { LeaderboardView } from './LeaderboardView.js';
import { TapView } from './TapView.js';
import { TasksView } from './TasksView.js';

type ModalType = 'tasks' | 'leaderboard' | 'boosters' | 'daily' | 'clan';

const ACTION_BUTTONS: { id: ModalType; icon: string; labelKey: string; color: string }[] = [
	{ id: 'tasks', icon: 'assignment', labelKey: 'airdrop.tasks.label', color: '#3390ec' },
	{ id: 'boosters', icon: 'rocket_launch', labelKey: 'airdrop.boosters.label', color: '#f59e0b' },
	{ id: 'clan', icon: 'shield', labelKey: 'airdrop.clan.label', color: '#ef4444' },
	{
		id: 'leaderboard',
		icon: 'emoji_events',
		labelKey: 'airdrop.leaderboard.label',
		color: '#cd7f32',
	},
];

export const AirdropPage: Component = () => {
	const [activeModal, setActiveModal] = createSignal<ModalType | null>(null);
	let modalRef: HTMLDivElement | undefined;

	createEffect(() => {
		if (activeModal()) {
			backButton.show();
			const off = backButton.onClick(closeModal);
			onCleanup(() => {
				off();
				backButton.hide();
			});
		} else {
			backButton.hide();
		}
	});

	createEffect(() => {
		if (activeModal() && modalRef) {
			const focusableElements = modalRef.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
			);
			if (focusableElements.length === 0) return;

			const firstElement = focusableElements[0] as HTMLElement;
			const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

			const handleTab = (e: KeyboardEvent) => {
				if (e.key !== 'Tab') return;
				if (e.shiftKey) {
					if (document.activeElement === firstElement) {
						lastElement.focus();
						e.preventDefault();
					}
				} else {
					if (document.activeElement === lastElement) {
						firstElement.focus();
						e.preventDefault();
					}
				}
			};

			modalRef.addEventListener('keydown', handleTab);
			firstElement?.focus();
			onCleanup(() => modalRef?.removeEventListener('keydown', handleTab));
		}
	});

	// Theme colors are now handled globally in init.ts

	const openModal = (modal: ModalType) => {
		try {
			hapticFeedback.selectionChanged();
		} catch (_) {}
		setActiveModal(modal);
	};

	const closeModal = () => {
		try {
			hapticFeedback.selectionChanged();
		} catch (_) {}
		setActiveModal(null);
	};

	return (
		<div
			class="flex flex-col bg-[#0f1014] relative overflow-hidden"
			style={{ 'min-height': 'var(--tg-viewport-stable-height, 100vh)' }}
		>
			{/* Premium Header */}
			<div class="px-4 pt-4 pb-2 z-20 flex flex-col gap-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<div
							class="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg"
							style={{
								background: `linear-gradient(135deg, ${currentLeague().color}, ${currentLeague().color}88)`,
							}}
						>
							<span
								class="material-symbols-outlined text-white text-lg"
								style={{ 'font-variation-settings': '"FILL" 1' }}
							>
								{currentLeague().icon}
							</span>
						</div>
						<div>
							<div class="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
								{t('airdrop.tap.league')}
							</div>
							<div class="text-sm text-white font-black leading-none">{currentLeague().name}</div>
						</div>
					</div>

					<div class="flex items-center gap-2">
						<button
							onClick={() => openModal('daily')}
							class={`h-9 px-3 rounded-xl flex items-center gap-2 transition-all border border-white/5 ${
								!checkedInToday()
									? 'bg-amber-400/20 text-amber-400 animate-pulse'
									: 'bg-white/5 text-on-surface-variant'
							}`}
						>
							<span
								class="material-symbols-outlined text-lg"
								style={{ 'font-variation-settings': '"FILL" 1' }}
							>
								redeem
							</span>
							<span class="text-[10px] font-black uppercase tracking-wider">
								{t('airdrop.daily.label')}
							</span>
						</button>
					</div>
				</div>

				{/* Clan prominent badge */}
				<Show
					when={userClan()}
					fallback={
						<button
							onClick={() => openModal('clan')}
							class="w-full flex items-center justify-between bg-white/5 border border-white/[0.04] p-3 rounded-2xl active:scale-[0.98] transition-transform"
						>
							<div class="flex items-center gap-2.5">
								<div class="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-sm">
									🛡️
								</div>
								<div class="text-left">
									<div class="text-white font-bold text-xs">{t('airdrop.clan.noClanTitle')}</div>
									<div class="text-[#8e8e93] text-[10px]">{t('airdrop.clan.noClanDesc')}</div>
								</div>
							</div>
							<span class="material-symbols-outlined text-[#8e8e93] text-sm">chevron_right</span>
						</button>
					}
				>
					{(clan) => (
						<button
							onClick={() => openModal('clan')}
							class="w-full flex items-center justify-between bg-[#1c1c1e]/80 backdrop-blur-lg border border-red-500/20 p-3 rounded-2xl active:scale-[0.98] transition-transform"
						>
							<div class="flex items-center gap-2.5">
								<img
									src={clan.channel_photo || 'https://telegram.org/img/t_logo.png'}
									alt={clan.chat_title}
									class="w-8 h-8 rounded-xl object-cover border border-white/10"
								/>
								<div class="text-left">
									<div class="text-white font-black text-xs">{clan.chat_title}</div>
									<div class="text-red-400 font-bold text-[10px] flex items-center gap-1 mt-0.5">
										<span
											class="material-symbols-outlined text-[10px]"
											style={{ 'font-variation-settings': '"FILL" 1' }}
										>
											shield
										</span>
										{t('airdrop.clan.myClan')} • {clan.members_count.toLocaleString('en-US')}{' '}
										{t('airdrop.clan.members')}
									</div>
								</div>
							</div>
							<span class="material-symbols-outlined text-[#8e8e93] text-sm">chevron_right</span>
						</button>
					)}
				</Show>
			</div>

			{/* Main Content Area */}
			<div class="flex-1 overflow-hidden relative z-10 flex flex-col">
				<TapView />

				{/* Integrated Action Grid - Sits above the energy bar but integrated */}
				<div class="px-4 pb-32 -mt-4">
					<div class="grid grid-cols-5 gap-2">
						<For each={ACTION_BUTTONS}>
							{(btn) => (
								<button
									onClick={() => openModal(btn.id)}
									class="flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl bg-white/5 border border-white/5 active:scale-90 transition-all group"
								>
									<span
										class="material-symbols-outlined text-xl transition-colors group-hover:scale-110"
										style={{ color: btn.color, 'font-variation-settings': '"FILL" 1' }}
									>
										{btn.icon}
									</span>
									<span class="text-[8px] font-black text-on-surface-variant uppercase tracking-tighter group-hover:text-white">
										{t(btn.labelKey as import('@/shared/i18n/index.js').DictPaths)}
									</span>
								</button>
							)}
						</For>
					</div>
				</div>
			</div>

			<BottomNav />

			<Show when={activeModal()}>
				<div
					ref={modalRef}
					class="fixed inset-0 z-[60] bg-[#0f1014] flex flex-col animate-slide-up pb-32"
					role="dialog"
					aria-modal="true"
					aria-labelledby="modal-title"
				>
					<div class="flex items-center justify-between p-4 bg-[#1c1c1c]/90 backdrop-blur-xl border-b border-white/10 z-10">
						<h2 id="modal-title" class="text-white font-black text-lg uppercase tracking-tight">
							{t(`airdrop.${activeModal()}.label` as import('@/shared/i18n/index.js').DictPaths)}
						</h2>
						<button
							onClick={closeModal}
							class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center active:scale-90 transition-transform border border-white/10"
							aria-label={t('common.close')}
						>
							<span class="material-symbols-outlined text-white text-xl">close</span>
						</button>
					</div>
					<div class="flex-1 overflow-y-auto relative bg-[#0f1014] no-scrollbar">
						<Suspense
							fallback={
								<div class="flex items-center justify-center h-full">
									<div class="w-8 h-8 border-2 border-[#3390ec] border-t-transparent rounded-full animate-spin"></div>
								</div>
							}
						>
							<Switch>
								<Match when={activeModal() === 'tasks'}>
									<TasksView />
								</Match>
								<Match when={activeModal() === 'leaderboard'}>
									<LeaderboardView />
								</Match>
								<Match when={activeModal() === 'boosters'}>
									<BoostersView />
								</Match>
								<Match when={activeModal() === 'daily'}>
									<DailyRewardView />
								</Match>
								<Match when={activeModal() === 'clan'}>
									<ClanView />
								</Match>
							</Switch>
						</Suspense>
					</div>
				</div>
			</Show>
		</div>
	);
};
