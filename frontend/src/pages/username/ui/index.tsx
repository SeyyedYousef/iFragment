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
	length: number;
	dictionary: {
		is_word: boolean;
		part_of_speech?: string;
		definition?: string;
	};
	history: {
		is_sold: boolean;
		owner_address?: string;
		highest_past_sale_ton?: number;
	};
	similar: {
		username: string;
		reason: string;
	}[];
	structure: {
		has_digits: boolean;
		letters_only: boolean;
		has_underscore: boolean;
	};
	seo: {
		score: number;
		verdict: string;
	};
	reasoning_log: Record<string, any>;
}

export const UsernamePage: Component = () => {
	const [searchParams] = useSearchParams();
	const [data, setData] = createSignal<ValuationResult | null>(null);
	const [loading, setLoading] = createSignal<boolean>(true);
	const [error, setError] = createSignal<string | null>(null);
	const [sharing, setSharing] = createSignal<boolean>(false);
	const [downloading, setDownloading] = createSignal<boolean>(false);
	const [sent, setSent] = createSignal<boolean>(false);
	const [sendCount, setSendCount] = createSignal<number>(0);

	const username = () => searchParams.u || '';
	let cardRef: HTMLDivElement | undefined;
	let hiddenCardRef: HTMLDivElement | undefined;
	const [tilt, setTilt] = createSignal({ x: 0, y: 0, glossX: 50, glossY: 50 });
	const handleMouseMove = (e: MouseEvent) => {
		if (!cardRef) return;
		const rect = cardRef.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const xc = rect.width / 2;
		const yc = rect.height / 2;
		const tiltX = (yc - y) / 12;
		const tiltY = (x - xc) / 12;
		const glossX = (x / rect.width) * 100;
		const glossY = (y / rect.height) * 100;
		setTilt({ x: tiltX, y: tiltY, glossX, glossY });
	};

	const handleMouseLeave = () => {
		setTilt({ x: 0, y: 0, glossX: 50, glossY: 50 });
	};

	const getFontSize = (name: string) => {
		const len = name.length;
		if (len <= 5) return '44px';
		if (len <= 8) return '36px';
		if (len <= 12) return '28px';
		return '22px';
	};

	const getTierStyle = (tier: string) => {
		const t = (tier || '').toLowerCase();
		if (t.includes('legendary') || t.includes('grail')) {
			return 'from-yellow-400/20 via-amber-500/15 to-yellow-600/10 border-yellow-400/40 text-yellow-400 shadow-[0_0_20px_rgba(251,191,36,0.25)]';
		}
		if (t.includes('epic') || t.includes('elite')) {
			return 'from-cyan-400/20 to-blue-500/10 border-cyan-400/40 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.25)]';
		}
		if (t.includes('rare') || t.includes('premium')) {
			return 'from-purple-400/20 to-pink-500/10 border-purple-400/40 text-purple-400 shadow-[0_0_20px_rgba(192,38,211,0.25)]';
		}
		return 'from-white/10 to-white/5 border-white/20 text-white/70';
	};

	const getUsernameGradient = (tier: string) => {
		const t = (tier || '').toLowerCase();
		if (t.includes('legendary') || t.includes('grail')) {
			return 'from-yellow-200 via-amber-400 to-yellow-500';
		}
		if (t.includes('epic') || t.includes('elite')) {
			return 'from-cyan-300 via-blue-400 to-indigo-500';
		}
		if (t.includes('rare') || t.includes('premium')) {
			return 'from-purple-300 via-pink-400 to-red-400';
		}
		return 'from-white via-neutral-100 to-neutral-400';
	};

	const handleSendToChat = async () => {
		if (!hiddenCardRef || downloading()) return;
		if (sendCount() >= 2) {
			if ((window as any).Telegram?.WebApp?.showAlert) {
				(window as any).Telegram.WebApp.showAlert(t('valuation.err_server') || 'You have reached the send limit. Please try again later.');
			} else {
				alert(t('valuation.err_server') || 'You have reached the send limit. Please try again later.');
			}
			return;
		}

		setDownloading(true);
		setSent(false);
		try {
			try {
				hapticFeedback.impactOccurred('medium');
			} catch (_) {}
			
			// Generate crisp flat image from flat hiddenCardRef
			const dataUrl = await toPng(hiddenCardRef, {
				width: 400,
				height: 400,
				pixelRatio: 3,
			});

			const response = await apiFetch<{ success: boolean }>('/usernames/send-to-chat', {
				method: 'POST',
				body: JSON.stringify({ image: dataUrl }),
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response && response.success) {
				try {
					hapticFeedback.notificationOccurred('success');
				} catch (_) {}
				setSent(true);
				setSendCount(sendCount() + 1);
				setTimeout(() => setSent(false), 3000);
			}
		} catch (err) {
			console.error('Failed to send image to chat:', err);
			if ((window as any).Telegram?.WebApp?.showAlert) {
				(window as any).Telegram.WebApp.showAlert(t('valuation.err_server') || 'Failed to send. Please try again.');
			} else {
				alert(t('valuation.err_server') || 'Failed to send. Please try again.');
			}
		} finally {
			setDownloading(false);
		}
	};

	const handleShareToStory = async () => {
		const u = data()?.username || username();
		if (!u || !hiddenCardRef || sharing()) return;

		setSharing(true);
		try {
			try {
				hapticFeedback.impactOccurred('medium');
			} catch (_) {}

			// Generate flat image from flat hiddenCardRef
			// Use pixelRatio: 3 to ensure high quality, html-to-image handles the internal scaling.
			const dataUrl = await toPng(hiddenCardRef, {
				width: 400,
				height: 400,
				pixelRatio: 3,
			});

			// Upload custom image to backend to get public HTTPS URL
			const response = await apiFetch<{ url: string }>('/usernames/share', {
				method: 'POST',
				body: JSON.stringify({ image: dataUrl }),
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response && response.url) {
				const storyText = `Check out the market valuation of @${u} on iFragment! 💎`;
				shareToStory(response.url, {
					text: storyText,
					widget_link: {
						url: `https://t.me/iFragmentBot/iFragment?startapp=val_${u}`,
						name: 'iFragment',
					},
				});
			} else {
				console.error('Failed to upload share image');
			}
		} catch (err) {
			console.error('Failed to share to story:', err);
		} finally {
			setSharing(false);
		}
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
				<div class="min-h-screen bg-[#0f1014] text-white px-5 py-6 flex flex-col items-center font-sans pb-24">
					{/* Flex Card Container Wrapper (Gradient Border) */}
					<div 
						class="w-full max-w-[400px] aspect-square p-[1.5px] bg-gradient-to-br from-cyan-400 via-purple-600 to-pink-500 rounded-[42px] shadow-[0_30px_70px_rgba(0,0,0,0.85),0_0_40px_rgba(157,0,255,0.15)] transition-all duration-300 hover:shadow-[0_40px_80px_rgba(0,0,0,0.95),0_0_60px_rgba(0,245,255,0.25)] mb-4"
						style={{ "aspect-ratio": "1 / 1" }}
					>
						<div 
							ref={cardRef}
							onMouseMove={handleMouseMove}
							onMouseLeave={handleMouseLeave}
							class="w-full h-full bg-[#07080a] rounded-[40px] p-8 relative overflow-hidden flex flex-col justify-between"
							style={{ 
								transform: `perspective(1000px) rotateX(${tilt().x}deg) rotateY(${tilt().y}deg)`,
								"background-image": "radial-gradient(rgba(255, 255, 255, 0.05) 1.2px, transparent 1.2px)", 
								"background-size": "18px 18px",
								transition: "transform 0.08s ease-out",
							}}
						>
							{/* Gloss light reflection layer */}
							<div 
								class="absolute inset-0 pointer-events-none z-20 mix-blend-overlay transition-opacity duration-300 opacity-60"
								style={{
									background: `radial-gradient(circle at ${tilt().glossX}% ${tilt().glossY}%, rgba(255,255,255,0.2) 0%, transparent 60%)`
								}}
							/>

							{/* Background Glow Orbs */}
							<div class="absolute -top-24 -left-24 w-64 h-64 bg-[#00f5ff]/10 rounded-full blur-[90px] pointer-events-none" />
							<div class="absolute -bottom-24 -right-24 w-60 h-60 bg-[#a100ff]/10 rounded-full blur-[90px] pointer-events-none" />
							<div class="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
							
							{/* Shimmer Effect */}
							<div 
								class="absolute inset-0 pointer-events-none opacity-20"
								style={{
									background: "linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.03) 55%, transparent 70%)"
								}}
							/>

							{/* Card Header */}
							<div class="flex justify-between items-center z-10">
								<span 
									class={`px-4 py-1.5 border rounded-full text-[10px] font-black tracking-wider uppercase ${getTierStyle(data()?.rarity?.tier || '')}`}
								>
									{data()?.rarity?.tier || 'Standard'}
								</span>
								<span class="text-[11px] font-mono font-black text-white/30 tracking-[5px] uppercase">
									iFragment
								</span>
							</div>

							{/* Card Body (Username) */}
							<div class="flex flex-col justify-center items-center z-10 text-center flex-grow relative py-8 w-full">
								{/* Direct radial gradient glow behind username (no blur, 100% compatible with HTML-to-Image download) */}
								<div 
									class="absolute w-[90%] h-[120px] opacity-75 -z-10 pointer-events-none"
									style={{
										background: "radial-gradient(ellipse 65% 55% at 50% 50%, rgba(0, 245, 255, 0.22) 0%, rgba(157, 0, 255, 0.16) 45%, transparent 75%)"
									}}
								/>
								{/* Bounding bracket designs */}
								<div class="flex items-center justify-center gap-1.5 w-full">
									<span class="text-white/25 font-black text-[28px] select-none tracking-normal">✦</span>
									<span 
										class={`inline-block font-black tracking-tight bg-gradient-to-r ${getUsernameGradient(data()?.rarity?.tier || '')} bg-clip-text text-transparent drop-shadow-[0_12px_24px_rgba(0,0,0,0.75)] truncate max-w-[85%]`}
										style={{ "font-size": getFontSize(data()?.username || username()) }}
										dir="ltr"
									>
										@{data()?.username || username()}
									</span>
									<span class="text-white/25 font-black text-[28px] select-none tracking-normal">✦</span>
								</div>
							</div>

							{/* Card Footer */}
							<div class="flex justify-between items-end border-t border-white/[0.06] pt-5 z-10">
								<div class="flex flex-col gap-1.5 text-left">
									<span class="text-[9px] font-black text-white/40 uppercase tracking-[2px]">
										Estimated Value
									</span>
									<div class="flex items-center gap-1.5">
										<svg class="w-6.5 h-6.5 filter drop-shadow-[0_0_10px_rgba(0,152,234,0.6)]" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
											<path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" fill="#0098EA" />
											<path d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5765 22.4861C43.3045 19.4202 41.0761 15.6277 37.5765 15.6277H37.5603ZM26.2483 36.8068L23.6119 31.8097L17.2017 20.6506C16.6742 19.7557 17.3255 18.6198 18.4223 18.6198H26.2483V36.8068ZM38.7972 20.6506L32.387 31.8259L29.7506 36.8068V18.6361H37.5765C38.6734 18.6361 39.3247 19.772 38.7972 20.6669V20.6506Z" fill="white" />
										</svg>
										<span class="text-[26px] sm:text-[28px] font-black text-white leading-none drop-shadow-[0_0_15px_rgba(0,152,234,0.3)]" style={{ "font-family": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
											{parseFloat(data()?.expected_ton || '0').toLocaleString('en-US', { numberingSystem: 'latn' })}
										</span>
										<span class="text-[13px] font-bold text-[#3390ec] leading-none">TON</span>
									</div>
								</div>

								<div class="flex flex-col items-end gap-2">
									<div class="flex items-center gap-1.5 bg-[#00ff88]/10 px-3 py-1 rounded-full border border-[#00ff88]/30 text-[#00ff88] font-black uppercase tracking-wider text-[9px] shadow-[0_0_15px_rgba(0,255,136,0.15)]">
										<div class="w-1.5 h-1.5 bg-[#00ff88] rounded-full animate-pulse shadow-[0_0_8px_#00ff88]" />
										Valued
									</div>
									<span class="text-[13px] text-white/60 font-black leading-none" style={{ "font-family": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
										≈ ${parseFloat(data()?.expected_usd || '0').toLocaleString('en-US', { maximumFractionDigits: 0, numberingSystem: 'latn' })}
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* Action Buttons */}
					<div class="flex gap-4 w-full max-w-[400px]">
						<button 
							onClick={handleSendToChat}
							disabled={downloading() || sent()}
							class={`flex-1 h-12 border text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer text-[14px] disabled:opacity-50 disabled:cursor-not-allowed ${sent() ? 'bg-green-500/20 border-green-500/50 hover:bg-green-500/30 text-green-400' : 'bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border-white/10'}`}
						>
							<Show 
								when={!downloading()} 
								fallback={
									<>
										<div class="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
										<span>{t('valuation.sending') || 'Sending...'}</span>
									</>
								}
							>
								<Show
									when={!sent()}
									fallback={
										<>
											<span class="material-symbols-outlined text-[20px] text-green-400">check_circle</span>
											<span class="text-green-400">{t('valuation.sent_to_chat') || 'Sent!'}</span>
										</>
									}
								>
									<span class="material-symbols-outlined text-[20px]">send</span>
									{t('valuation.download') || 'Send to Chat'}
								</Show>
							</Show>
						</button>
						<button 
							onClick={handleShareToStory}
							disabled={sharing()}
							class="flex-1 h-12 bg-[#3390ec] hover:bg-[#2b82d9] active:scale-95 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_4px_12px_rgba(51,144,236,0.3)] cursor-pointer text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<Show 
								when={!sharing()} 
								fallback={
									<>
										<div class="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
										<span>{t('valuation.sharing') || 'Uploading...'}</span>
									</>
								}
							>
								<span class="material-symbols-outlined text-[20px]">share</span>
								{t('valuation.share') || 'Share to Story'}
							</Show>
						</button>
					</div>

					{/* Reports Section */}
					<div class="w-full max-w-[400px] mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 pb-12">
						{/* Identity & Linguistics */}
						<div class="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
							<div class="flex items-center gap-2 text-white/80 mb-1">
								<span class="material-symbols-outlined text-[20px] text-cyan-400">translate</span>
								<span class="text-sm font-bold uppercase tracking-wider">{t('valuation.dict_title') || 'Identity & Linguistics'}</span>
							</div>
							<div class="flex items-center justify-between bg-white/[0.02] rounded-xl p-3">
								<span class="text-white/60 text-sm">{t('valuation.len')?.replace('{count}', data()?.length?.toString() || '0') || `Length: ${data()?.length} chars`}</span>
								<span class="text-white font-mono">{data()?.length}</span>
							</div>
							<Show
								when={data()?.dictionary?.is_word}
								fallback={
									<div class="flex items-center justify-center bg-white/[0.02] rounded-xl p-4 border border-white/5">
										<span class="text-white/40 text-sm italic">{t('valuation.dict_none') || 'Not a dictionary word'}</span>
									</div>
								}
							>
								<div class="flex flex-col bg-white/[0.02] rounded-xl p-3 border border-white/5 relative overflow-hidden">
									<div class="absolute right-0 top-0 w-16 h-16 bg-cyan-500/10 rounded-bl-full pointer-events-none" />
									<span class="text-cyan-400 text-xs font-bold uppercase mb-1">
										{data()?.dictionary?.part_of_speech === 'Noun' ? (t('valuation.noun') || 'Noun') : 
										 data()?.dictionary?.part_of_speech === 'Verb' ? (t('valuation.verb') || 'Verb') : 
										 data()?.dictionary?.part_of_speech === 'Adjective' ? (t('valuation.adjective') || 'Adjective') : 
										 data()?.dictionary?.part_of_speech || (t('valuation.unknown') || 'Unknown')}
									</span>
									<span class="text-white/80 text-sm leading-relaxed">{data()?.dictionary?.definition}</span>
								</div>
							</Show>
						</div>

						{/* Structural Anatomy */}
						<div class="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
							<div class="flex items-center gap-2 text-white/80 mb-1">
								<span class="material-symbols-outlined text-[20px] text-pink-400">biotech</span>
								<span class="text-sm font-bold uppercase tracking-wider">{t('valuation.struct_title') || 'Structural Anatomy'}</span>
							</div>
							
							<div class="flex items-center justify-between bg-white/[0.02] rounded-xl p-3">
								<span class="text-white/60 text-sm">{t('valuation.has_digits') || 'Contains Digits'}</span>
								<div class="flex items-center gap-1">
									<Show when={data()?.structure?.has_digits} fallback={
										<><span class="material-symbols-outlined text-green-400 text-[18px]">check_circle</span> <span class="text-green-400 font-bold text-sm">{t('valuation.no') || 'No'}</span></>
									}>
										<span class="material-symbols-outlined text-red-400 text-[18px]">cancel</span> <span class="text-red-400 font-bold text-sm">{t('valuation.yes') || 'Yes'}</span>
									</Show>
								</div>
							</div>

							<div class="flex items-center justify-between bg-white/[0.02] rounded-xl p-3">
								<span class="text-white/60 text-sm">{t('valuation.has_underscore') || 'Contains Underline (_)'}</span>
								<div class="flex items-center gap-1">
									<Show when={data()?.structure?.has_underscore} fallback={
										<><span class="material-symbols-outlined text-green-400 text-[18px]">check_circle</span> <span class="text-green-400 font-bold text-sm">{t('valuation.no') || 'No'}</span></>
									}>
										<span class="material-symbols-outlined text-red-400 text-[18px]">cancel</span> <span class="text-red-400 font-bold text-sm">{t('valuation.yes') || 'Yes'}</span>
									</Show>
								</div>
							</div>

							<div class="flex items-center justify-between bg-white/[0.02] rounded-xl p-3">
								<span class="text-white/60 text-sm">{t('valuation.letters_only') || 'Letters Only'}</span>
								<div class="flex items-center gap-1">
									<Show when={data()?.structure?.letters_only} fallback={
										<><span class="material-symbols-outlined text-red-400 text-[18px]">cancel</span> <span class="text-red-400 font-bold text-sm">{t('valuation.no') || 'No'}</span></>
									}>
										<span class="material-symbols-outlined text-green-400 text-[18px]">check_circle</span> <span class="text-green-400 font-bold text-sm">{t('valuation.yes') || 'Yes'}</span>
									</Show>
								</div>
							</div>
						</div>

						{/* Global Search SEO */}
						<div class="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
							<div class="flex items-center gap-2 text-white/80 mb-1">
								<span class="material-symbols-outlined text-[20px] text-blue-400">travel_explore</span>
								<span class="text-sm font-bold uppercase tracking-wider">{t('valuation.seo_title') || 'Global Search Potential'}</span>
							</div>
							
							<div class="flex items-center gap-4 bg-white/[0.02] rounded-xl p-4 border border-white/5">
								<div class="relative w-16 h-16 flex items-center justify-center shrink-0">
									<svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
										<path
											class="text-white/10"
											stroke-width="3"
											stroke="currentColor"
											fill="none"
											d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
										/>
										<path
											class={(data()?.seo?.score || 0) >= 70 ? "text-green-400" : (data()?.seo?.score || 0) >= 40 ? "text-yellow-400" : "text-red-400"}
											stroke-dasharray={`${data()?.seo?.score || 0}, 100`}
											stroke-width="3"
											stroke-linecap="round"
											stroke="currentColor"
											fill="none"
											d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
										/>
									</svg>
									<div class="absolute inset-0 flex items-center justify-center flex-col">
										<span class="text-white font-bold text-lg leading-none">{data()?.seo?.score || 0}</span>
									</div>
								</div>
								<div class="flex flex-col">
									<span class={`font-bold text-lg ${(data()?.seo?.score || 0) >= 70 ? "text-green-400" : (data()?.seo?.score || 0) >= 40 ? "text-yellow-400" : "text-red-400"}`}>
										{(data()?.seo?.score || 0) >= 70 ? (t('valuation.seo_excellent') || 'Excellent') : 
										 (data()?.seo?.score || 0) >= 40 ? (t('valuation.seo_moderate') || 'Moderate') : 
										 (t('valuation.seo_poor') || 'Poor')}
									</span>
									<span class="text-white/50 text-xs mt-1 leading-relaxed">
										Higher score means better visibility in Telegram global search.
									</span>
								</div>
							</div>
						</div>

						<div class="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
							<div class="flex items-center gap-2 text-white/80 mb-1">
								<span class="material-symbols-outlined text-[20px] text-purple-400">history</span>
								<span class="text-sm font-bold uppercase tracking-wider">{t('valuation.history_title') || 'History & Ownership'}</span>
							</div>
							<Show
								when={data()?.history?.is_sold}
								fallback={
									<div class="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
										<span class="material-symbols-outlined text-green-400">verified</span>
										<span class="text-green-400 text-sm font-medium">{t('valuation.not_sold') || 'Status: Never sold on Fragment!'}</span>
									</div>
								}
							>
								<div class="flex flex-col gap-2">
									<Show when={data()?.history?.owner_address}>
										<div class="flex items-center justify-between bg-white/[0.02] rounded-xl p-3">
											<span class="text-white/60 text-sm">{t('valuation.owner') || 'Current Owner:'}</span>
											<div class="flex items-center gap-2">
												<span class="text-white/90 font-mono text-xs max-w-[100px] truncate">{data()?.history?.owner_address}</span>
												<button 
													class="text-[#3390ec] hover:text-[#2b82d9]"
													onClick={() => {
														navigator.clipboard.writeText(data()?.history?.owner_address || '');
														try { hapticFeedback.impactOccurred('light'); } catch (_) {}
													}}
												>
													<span class="material-symbols-outlined text-[16px]">content_copy</span>
												</button>
											</div>
										</div>
									</Show>
									<div class="flex items-center justify-between bg-white/[0.02] rounded-xl p-3">
										<span class="text-white/60 text-sm">{t('valuation.sold_for') || 'Highest Sale:'}</span>
										<div class="flex items-center gap-1">
											<span class="text-white font-bold">{data()?.history?.highest_past_sale_ton}</span>
											<span class="text-[#3390ec] font-bold text-sm">TON</span>
										</div>
									</div>
								</div>
							</Show>
						</div>

						{/* AI Suggestions */}
						<Show when={(data()?.similar?.length ?? 0) > 0}>
							<div class="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
								<div class="flex items-center gap-2 text-white/80 mb-1">
									<span class="material-symbols-outlined text-[20px] text-yellow-400">psychology</span>
									<span class="text-sm font-bold uppercase tracking-wider">{t('valuation.similar_title') || 'AI Alternative Suggestions'}</span>
								</div>
								<div class="flex gap-3 overflow-x-auto pb-2 snap-x hide-scrollbar">
									{data()?.similar?.map(sim => (
										<div class="min-w-[200px] flex-shrink-0 bg-white/[0.02] border border-white/5 rounded-xl p-3 snap-start cursor-pointer hover:bg-white/[0.05] transition-colors"
											onClick={() => {
												window.location.href = `/username?u=${sim.username}`;
											}}
										>
											<div class="text-[#3390ec] font-bold mb-1 truncate">@{sim.username}</div>
											<div class="text-white/50 text-xs line-clamp-2 leading-relaxed">{sim.reason}</div>
										</div>
									))}
								</div>
							</div>
						</Show>
					</div>
				</div>
			</Show>

			{/* Hidden Card for clean, crop-free image rendering */}
			<div style={{ position: 'fixed', left: '0px', top: '0px', width: '400px', height: '400px', 'z-index': '-9999', 'pointer-events': 'none' }}>
				<div 
					ref={hiddenCardRef}
					class="w-[400px] h-[400px] bg-[#07080a] border border-white/[0.1] rounded-[40px] p-8 relative overflow-hidden flex flex-col justify-between"
					style={{ 
						"background-image": "radial-gradient(rgba(255, 255, 255, 0.05) 1.2px, transparent 1.2px)", 
						"background-size": "18px 18px",
					}}
				>
					{/* Background Glow Orbs */}
					<div class="absolute -top-24 -left-24 w-64 h-64 bg-[#00f5ff]/10 rounded-full blur-[90px] pointer-events-none" />
					<div class="absolute -bottom-24 -right-24 w-60 h-60 bg-[#a100ff]/10 rounded-full blur-[90px] pointer-events-none" />
					<div class="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
					
					{/* Shimmer Effect */}
					<div 
						class="absolute inset-0 pointer-events-none opacity-20"
						style={{
							background: "linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.03) 55%, transparent 70%)"
						}}
					/>

					{/* Card Header */}
					<div class="flex justify-between items-center z-10">
						<span 
							class={`px-4 py-1.5 border rounded-full text-[10px] font-black tracking-wider uppercase ${getTierStyle(data()?.rarity?.tier || '')}`}
						>
							{data()?.rarity?.tier || 'Standard'}
						</span>
						<span class="text-[11px] font-mono font-black text-white/30 tracking-[5px] uppercase">
							iFragment
						</span>
					</div>

					{/* Card Body (Username) */}
					<div class="flex flex-col justify-center items-center z-10 text-center flex-grow relative py-8 w-full">
						<div 
							class="absolute w-[90%] h-[120px] opacity-75 -z-10 pointer-events-none"
							style={{
								background: "radial-gradient(ellipse 65% 55% at 50% 50%, rgba(0, 245, 255, 0.22) 0%, rgba(157, 0, 255, 0.16) 45%, transparent 75%)"
							}}
						/>
						<div class="flex items-center justify-center gap-1.5 w-full">
							<span class="text-white/25 font-black text-[28px] select-none tracking-normal">✦</span>
							<span 
								class={`inline-block font-black tracking-tight bg-gradient-to-r ${getUsernameGradient(data()?.rarity?.tier || '')} bg-clip-text text-transparent drop-shadow-[0_12px_24px_rgba(0,0,0,0.75)] truncate max-w-[85%]`}
								style={{ "font-size": getFontSize(data()?.username || username()) }}
								dir="ltr"
							>
								@{data()?.username || username()}
							</span>
							<span class="text-white/25 font-black text-[28px] select-none tracking-normal">✦</span>
						</div>
					</div>

					{/* Card Footer */}
					<div class="flex justify-between items-end border-t border-white/[0.06] pt-5 z-10">
						<div class="flex flex-col gap-1.5 text-left">
							<span class="text-[9px] font-black text-white/40 uppercase tracking-[2px]">
								Estimated Value
							</span>
							<div class="flex items-center gap-1.5">
								<svg class="w-6.5 h-6.5 filter drop-shadow-[0_0_10px_rgba(0,152,234,0.6)]" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" fill="#0098EA" />
									<path d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5765 22.4861C43.3045 19.4202 41.0761 15.6277 37.5765 15.6277H37.5603ZM26.2483 36.8068L23.6119 31.8097L17.2017 20.6506C16.6742 19.7557 17.3255 18.6198 18.4223 18.6198H26.2483V36.8068ZM38.7972 20.6506L32.387 31.8259L29.7506 36.8068V18.6361H37.5765C38.6734 18.6361 39.3247 19.772 38.7972 20.6669V20.6506Z" fill="white" />
								</svg>
								<span class="text-[26px] sm:text-[28px] font-black text-white leading-none drop-shadow-[0_0_15px_rgba(0,152,234,0.3)]" style={{ "font-family": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
									{parseFloat(data()?.expected_ton || '0').toLocaleString('en-US', { numberingSystem: 'latn' })}
								</span>
								<span class="text-[13px] font-bold text-[#3390ec] leading-none">TON</span>
							</div>
						</div>

						<div class="flex flex-col items-end gap-2">
							<div class="flex items-center gap-1.5 bg-[#00ff88]/10 px-3 py-1 rounded-full border border-[#00ff88]/30 text-[#00ff88] font-black uppercase tracking-wider text-[9px] shadow-[0_0_15px_rgba(0,255,136,0.15)]">
								<div class="w-1.5 h-1.5 bg-[#00ff88] rounded-full animate-pulse shadow-[0_0_8px_#00ff88]" />
								Valued
							</div>
							<span class="text-[13px] text-white/60 font-black leading-none" style={{ "font-family": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
								≈ ${parseFloat(data()?.expected_usd || '0').toLocaleString('en-US', { maximumFractionDigits: 0, numberingSystem: 'latn' })}
							</span>
						</div>
					</div>
				</div>
			</div>
		</Show>
	);
};

export default UsernamePage;
