import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { type Component, createSignal, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { SkeletonBlock } from './Skeleton.js';

interface LockedReportCardProps {
	entityName: string; // e.g. "@durov", "+888 8888 8888", "Plush Pepe #42"
	category: 'username' | 'number' | 'gift';
	creditsAvailable: number;
	isUnlocking?: boolean;
	onUnlockWithCredit: () => Promise<void> | void;
	onUnlockWithCoins?: () => Promise<void> | void;
}

export const LockedReportCard: Component<LockedReportCardProps> = (props) => {
	const navigate = useNavigate();
	const [loading, setLoading] = createSignal(false);

	const handleUnlock = async () => {
		if (loading() || props.isUnlocking) return;
		try {
			haptic.impact('medium');
		} catch {}
		setLoading(true);
		try {
			await props.onUnlockWithCredit();
		} finally {
			setLoading(false);
		}
	};

	return (
		<div class="relative w-full max-w-[560px] mx-auto my-4 rounded-[28px] overflow-hidden border border-white/10 bg-[#12141C]/90 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
			{/* ━━━ Blurred Mock Skeleton Preview ━━━ */}
			<div
				class="relative p-6 transition-all duration-700 pointer-events-none select-none"
				style={{
					filter: 'blur(14px)',
					opacity: '0.45',
					transform: 'scale(0.98)',
				}}
				aria-hidden="true"
			>
				{/* Top Metrics Row */}
				<div class="flex items-center justify-between gap-4 mb-6">
					<div class="space-y-2 flex-1">
						<SkeletonBlock class="h-4 w-28 rounded-full bg-white/20" />
						<SkeletonBlock class="h-8 w-44 rounded-xl bg-white/20" />
					</div>
					<div class="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
						<span class="material-symbols-outlined text-white/30 text-2xl">verified</span>
					</div>
				</div>

				{/* Valuation Range Box */}
				<div class="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-3 mb-6">
					<div class="flex justify-between items-center">
						<SkeletonBlock class="h-3.5 w-32 rounded-full bg-white/20" />
						<SkeletonBlock class="h-3.5 w-16 rounded-full bg-white/20" />
					</div>
					<SkeletonBlock class="h-6 w-full rounded-lg bg-white/10" />
					<div class="grid grid-cols-3 gap-2 pt-2">
						<SkeletonBlock class="h-10 rounded-xl bg-white/10" />
						<SkeletonBlock class="h-10 rounded-xl bg-white/10" />
						<SkeletonBlock class="h-10 rounded-xl bg-white/10" />
					</div>
				</div>

				{/* Comps List Skeleton */}
				<div class="space-y-2">
					<SkeletonBlock class="h-12 w-full rounded-xl bg-white/[0.05]" />
					<SkeletonBlock class="h-12 w-full rounded-xl bg-white/[0.05]" />
				</div>
			</div>

			{/* ━━━ Foreground Paywall Gate Overlay ━━━ */}
			<div class="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-gradient-to-t from-[#0B0E14] via-[#0B0E14]/80 to-transparent">
				<Motion.div
					initial={{ opacity: 0, scale: 0.92 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.5, easing: [0.16, 1, 0.3, 1] }}
					class="w-full max-w-[420px] flex flex-col items-center text-center"
				>
					{/* Floating Lock Icon Badge */}
					<div class="w-14 h-14 rounded-2xl bg-[#3390EC]/15 border border-[#3390EC]/30 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(51,144,236,0.3)]">
						<span class="material-symbols-outlined text-[#3390EC] text-3xl">lock</span>
					</div>

					<h3 class="text-xl font-bold text-white mb-2 tracking-tight">
						{t('lockedReport.title')}
					</h3>
					<p class="text-xs text-white/60 mb-5 leading-relaxed max-w-[320px]">
						{t('lockedReport.subtitle', { name: props.entityName })}
					</p>

					{/* Feature Bullet Points */}
					<div class="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 mb-6 text-left space-y-2.5">
						<div class="flex items-center gap-2.5 text-xs text-white/80 font-medium">
							<span class="material-symbols-outlined text-[#30D158] text-[18px]">check_circle</span>
							<span>{t('lockedReport.featureFairValue')}</span>
						</div>
						<div class="flex items-center gap-2.5 text-xs text-white/80 font-medium">
							<span class="material-symbols-outlined text-[#30D158] text-[18px]">check_circle</span>
							<span>{t('lockedReport.featureComps')}</span>
						</div>
						<div class="flex items-center gap-2.5 text-xs text-white/80 font-medium">
							<span class="material-symbols-outlined text-[#30D158] text-[18px]">check_circle</span>
							<span>{t('lockedReport.featureProjection')}</span>
						</div>
					</div>

					{/* Dual Actions */}
					<div class="w-full space-y-3">
						<button
							type="button"
							onClick={handleUnlock}
							disabled={loading() || props.isUnlocking}
							class="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#3390EC] to-[#2071C4] hover:from-[#3a9afc] hover:to-[#2580dc] text-white font-semibold text-sm shadow-[0_4px_20px_rgba(51,144,236,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
						>
							<Show
								when={!loading() && !props.isUnlocking}
								fallback={
									<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
								}
							>
								<span class="material-symbols-outlined text-lg">bolt</span>
								<span>
									{props.creditsAvailable > 0
										? t('lockedReport.unlockWithCredit', { credits: props.creditsAvailable })
										: t('lockedReport.unlockNoCredit')}
								</span>
							</Show>
						</button>

						<div class="flex items-center justify-center gap-4 text-xs">
							<button
								type="button"
								onClick={() => navigate('/airdrop?tab=shop')}
								class="text-white/60 hover:text-white transition-colors underline underline-offset-4"
							>
								{t('lockedReport.buyCredits')}
							</button>
							<span class="text-white/20">•</span>
							<button
								type="button"
								onClick={() => navigate('/airdrop?tab=earn')}
								class="text-[#3390EC] hover:text-[#52a7ff] transition-colors"
							>
								{t('lockedReport.earnCredits')}
							</button>
						</div>
					</div>
				</Motion.div>
			</div>
		</div>
	);
};
