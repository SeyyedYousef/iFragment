import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, createEffect, onCleanup, onMount, Show } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { apiFetch } from '@/shared/api/base.js';
import { t } from '@/shared/i18n/index.js';
import { toPng } from 'html-to-image';
import { shareToStory } from '@/shared/lib/telegram-native.js';

interface ValuationResult {
	run_id: number;
	username: string;
	model_version: string;
	base_price_ton: string;
	low_ton: string;
	expected_ton: string;
	high_ton: string;
	low_usd: string;
	expected_usd: string;
	high_usd: string;
	confidence_score: number;
	ton_usd_rate: number;
	comparable_sales_count: number;
	rarity: {
		tier: string;
		stars: string;
	};
	tags: string[];
	reasoning_log: Record<string, any>;
}

export const UsernamePage: Component = () => {
	const [searchParams] = useSearchParams();
	const [data, setData] = createSignal<ValuationResult | null>(null);
	const [loading, setLoading] = createSignal<boolean>(true);
	const [error, setError] = createSignal<string | null>(null);

	const username = () => searchParams.u || '';
	let cardRef: HTMLDivElement | undefined;

	const getFontSize = (name: string) => {
		const len = name.length;
		if (len <= 5) return '44px';
		if (len <= 8) return '36px';
		if (len <= 12) return '28px';
		return '22px';
	};

	const handleDownload = async () => {
		if (!cardRef) return;
		try {
			try {
				hapticFeedback.impactOccurred('medium');
			} catch (_) {}
			const dataUrl = await toPng(cardRef, {
				pixelRatio: 2.5,
				style: {
					transform: 'scale(1)',
				}
			});
			const link = document.createElement('a');
			link.download = `ifragment-valuation-${data()?.username || 'card'}.png`;
			link.href = dataUrl;
			link.click();
		} catch (err) {
			console.error('Failed to generate image:', err);
		}
	};

	const handleShareToStory = () => {
		const u = data()?.username || username();
		if (!u) return;
		try {
			hapticFeedback.impactOccurred('medium');
		} catch (_) {}
		const storyText = `Check out the market valuation of @${u} on iFragment! 💎`;
		shareToStory(`${window.location.origin}/promo_banner.png`, {
			text: storyText,
			widget_link: {
				url: `https://t.me/iFragmentBot/iFragment?startapp=val_${u}`,
				name: 'iFragment',
			},
		});
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			try {
				hapticFeedback.impactOccurred('light');
			} catch (_) {}
			window.history.back();
		});

		onCleanup(() => {
			off();
			backButton.hide();
		});
	});

	createEffect(() => {
		const fetchValuation = async () => {
			const u = username();
			if (!u) return;

			setLoading(true);
			setError(null);
			try {
				const result = await apiFetch<ValuationResult>(`/usernames/valuate?u=${u}`);
				if (result) {
					setData(result);
				} else {
					setError(t('valuation.err_meta') || 'Failed to fetch metadata');
				}
			} catch (err: any) {
				setError(err.message || t('valuation.err_server') || 'A server communication error occurred');
			} finally {
				setLoading(false);
			}
		};

		fetchValuation();
	});

	return (
		<Show
			when={!loading()}
			fallback={
				<div class="flex flex-col justify-center items-center h-screen bg-[#0f1014] text-white/60 gap-4">
					<div class="w-10 h-10 rounded-full border-[3px] border-white/10 border-t-[#3390ec] animate-spin" />
					<span class="text-[13px] font-medium tracking-wide">{t('valuation.analyzing') || 'Analyzing market value...'}</span>
				</div>
			}
		>
			<Show
				when={!error()}
				fallback={
					<div class="min-h-screen bg-[#0f1014] text-white flex flex-col items-center justify-center p-6 text-center">
						<div class="w-16 h-16 rounded-full bg-[#ff453a]/10 flex items-center justify-center mb-4 text-[#ff453a]">
							<span class="material-symbols-outlined text-[32px]">error</span>
						</div>
						<h1 class="text-lg font-bold mb-2">{t('valuation.error_title') || 'Failed to load data'}</h1>
						<p class="text-[13px] text-white/40 leading-relaxed mb-6 max-w-xs">{error()}</p>
						<button
							onClick={() => window.history.back()}
							class="h-11 px-6 bg-white/[0.04] border border-white/10 text-white font-medium rounded-xl transition-all active:scale-95"
						>
							{t('valuation.back') || 'Back'}
						</button>
					</div>
				}
			>
				<div class="min-h-screen bg-[#0f1014] text-white px-5 py-8 flex flex-col items-center font-sans pb-24">
					{/* Glowing Header */}
					<div class="text-center mb-8 relative w-full">
						<div class="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#3390ec]/10 rounded-full blur-2xl pointer-events-none" />
						<span class="text-[28px] font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70 tracking-tight block mb-2" dir="ltr">
							@{data()?.username || username()}
						</span>
						<span class="px-2.5 py-1 bg-white/[0.04] border border-white/[0.06] rounded-full text-[10px] font-semibold tracking-wider text-white/40 uppercase">
							{t('valuation.title') || 'Market Valuation'}
						</span>
					</div>

					{/* Flex Card Container */}
					<div 
						ref={cardRef}
						class="w-full max-w-[400px] aspect-square bg-[#0c0d10] border border-white/[0.08] rounded-[36px] p-7 shadow-2xl relative overflow-hidden flex flex-col justify-between mb-6"
					>
						{/* Background Glow Orbs */}
						<div class="absolute -top-20 -left-20 w-56 h-56 bg-[#3390ec]/15 rounded-full blur-[80px] pointer-events-none" />
						<div class="absolute -bottom-20 -right-20 w-48 h-48 bg-[#9d00ff]/15 rounded-full blur-[80px] pointer-events-none" />
						<div class="absolute inset-0 bg-gradient-to-b from-white/[0.01] to-transparent pointer-events-none" />
						
						{/* Card Header */}
						<div class="flex justify-between items-center z-10">
							<span class="px-3.5 py-1.5 bg-gradient-to-br from-amber-400/20 to-orange-500/10 border border-amber-400/30 rounded-full text-[10px] font-bold tracking-wider text-amber-400 uppercase shadow-[0_0_15px_rgba(251,191,36,0.1)]">
								{data()?.rarity?.tier || 'Standard'}
							</span>
							<span class="text-[12px] font-mono font-black text-white/20 tracking-[4px] uppercase">
								iFragment
							</span>
						</div>

						{/* Card Body (Username) */}
						<div class="flex flex-col justify-center items-center z-10 text-center flex-grow relative py-8">
							<div class="absolute w-[80%] h-[60px] bg-gradient-to-r from-[#3390ec] to-[#9d00ff] blur-[50px] opacity-15 -z-10" />
							<span 
								class="font-black tracking-tight text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] truncate w-full"
								style={{ "font-size": getFontSize(data()?.username || username()) }}
							>
								@{data()?.username || username()}
							</span>
						</div>

						{/* Card Footer */}
						<div class="flex justify-between items-end border-t border-white/5 pt-4 z-10">
							<div class="flex flex-col gap-1 text-left">
								<span class="text-[10px] font-bold text-white/35 uppercase tracking-widest">
									Estimated Value
								</span>
								<div class="flex items-center gap-1.5">
									<svg class="w-6 h-6 filter drop-shadow-[0_0_8px_rgba(0,152,234,0.5)]" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" fill="#0098EA" />
										<path d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5765 22.4861C43.3045 19.4202 41.0761 15.6277 37.5765 15.6277H37.5603ZM26.2483 36.8068L23.6119 31.8097L17.2017 20.6506C16.6742 19.7557 17.3255 18.6198 18.4223 18.6198H26.2483V36.8068ZM38.7972 20.6506L32.387 31.8259L29.7506 36.8068V18.6361H37.5765C38.6734 18.6361 39.3247 19.772 38.7972 20.6669V20.6506Z" fill="white" />
									</svg>
									<span class="text-[24px] font-black text-white leading-none drop-shadow-[0_0_15px_rgba(0,152,234,0.3)]">
										{parseFloat(data()?.expected_ton || '0').toLocaleString()}
									</span>
									<span class="text-[13px] font-bold text-[#3390ec] leading-none">TON</span>
								</div>
							</div>

							<div class="flex flex-col items-end gap-1.5">
								<div class="flex items-center gap-1 bg-[#00ff88]/10 px-2 py-0.5 rounded-full border border-[#00ff88]/20 text-[#00ff88] font-bold uppercase tracking-wider text-[9px]">
									<div class="w-1.5 h-1.5 bg-[#00ff88] rounded-full shadow-[0_0_6px_#00ff88]" />
									Valued
								</div>
								<span class="text-[13px] text-white/50 font-bold leading-none">
									≈ ${parseFloat(data()?.expected_usd || '0').toLocaleString(undefined, { maximumFractionDigits: 0 })}
								</span>
							</div>
						</div>
					</div>

					{/* Action Buttons */}
					<div class="flex gap-4 w-full max-w-[400px]">
						<button 
							onClick={handleDownload}
							class="flex-1 h-12 bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/10 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer text-[14px]"
						>
							<span class="material-symbols-outlined text-[20px]">download</span>
							{t('valuation.download') || 'Download Card'}
						</button>
						<button 
							onClick={handleShareToStory}
							class="flex-1 h-12 bg-[#3390ec] hover:bg-[#2b82d9] active:scale-95 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_4px_12px_rgba(51,144,236,0.3)] cursor-pointer text-[14px]"
						>
							<span class="material-symbols-outlined text-[20px]">share</span>
							{t('valuation.share') || 'Share to Story'}
						</button>
					</div>
				</div>
			</Show>
		</Show>
	);
};

export default UsernamePage;
