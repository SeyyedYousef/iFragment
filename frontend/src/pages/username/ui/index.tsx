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
	const [showModal, setShowModal] = createSignal<boolean>(false);
	const [generatedImg, setGeneratedImg] = createSignal<string>('');
	const [sharing, setSharing] = createSignal<boolean>(false);
	const [downloading, setDownloading] = createSignal<boolean>(false);

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

	const handleDownload = async () => {
		if (!hiddenCardRef || downloading()) return;
		setDownloading(true);
		try {
			try {
				hapticFeedback.impactOccurred('medium');
			} catch (_) {}
			
			// Generate crisp flat image from flat hiddenCardRef
			const dataUrl = await toPng(hiddenCardRef, {
				pixelRatio: 3.0,
			});

			// Upload image to backend to get public HTTPS URL
			const response = await apiFetch<{ url: string }>('/usernames/share', {
				method: 'POST',
				body: JSON.stringify({ image: dataUrl }),
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response && response.url) {
				setGeneratedImg(response.url);
				setShowModal(true);

				// Programmatic desktop download fallback using public HTTPS URL
				const link = document.createElement('a');
				link.download = `ifragment-valuation-${data()?.username || 'card'}.png`;
				link.href = response.url;
				link.click();
			}
		} catch (err) {
			console.error('Failed to generate image:', err);
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
			const dataUrl = await toPng(hiddenCardRef, {
				pixelRatio: 3.0,
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

					{/* Flex Card Container Wrapper (Gradient Border) */}
					<div 
						class="w-full max-w-[400px] aspect-square p-[1.5px] bg-gradient-to-br from-cyan-400 via-purple-600 to-pink-500 rounded-[42px] shadow-[0_30px_70px_rgba(0,0,0,0.85),0_0_40px_rgba(157,0,255,0.15)] transition-all duration-300 hover:shadow-[0_40px_80px_rgba(0,0,0,0.95),0_0_60px_rgba(0,245,255,0.25)] mb-8"
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
										<span class="text-[26px] sm:text-[28px] font-black text-white leading-none drop-shadow-[0_0_15px_rgba(0,152,234,0.3)]">
											{parseFloat(data()?.expected_ton || '0').toLocaleString('en-US')}
										</span>
										<span class="text-[13px] font-bold text-[#3390ec] leading-none">TON</span>
									</div>
								</div>

								<div class="flex flex-col items-end gap-2">
									<div class="flex items-center gap-1.5 bg-[#00ff88]/10 px-3 py-1 rounded-full border border-[#00ff88]/30 text-[#00ff88] font-black uppercase tracking-wider text-[9px] shadow-[0_0_15px_rgba(0,255,136,0.15)]">
										<div class="w-1.5 h-1.5 bg-[#00ff88] rounded-full animate-pulse shadow-[0_0_8px_#00ff88]" />
										Valued
									</div>
									<span class="text-[13px] text-white/60 font-black leading-none">
										≈ ${parseFloat(data()?.expected_usd || '0').toLocaleString('en-US', { maximumFractionDigits: 0 })}
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* Action Buttons */}
					<div class="flex gap-4 w-full max-w-[400px]">
						<button 
							onClick={handleDownload}
							disabled={downloading()}
							class="flex-1 h-12 bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/10 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<Show 
								when={!downloading()} 
								fallback={
									<>
										<div class="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
										<span>{t('valuation.sharing') || 'Uploading...'}</span>
									</>
								}
							>
								<span class="material-symbols-outlined text-[20px]">download</span>
								{t('valuation.download') || 'Download Card'}
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

					{/* Download Preview Modal (for Mobile/Telegram Webview support) */}
					<Show when={showModal()}>
						<div class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07080a]/95 backdrop-blur-xl p-6 transition-all duration-300">
							{/* Close Button */}
							<button 
								onClick={() => setShowModal(false)}
								class="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer"
							>
								<span class="material-symbols-outlined text-[22px]">close</span>
							</button>

							<div class="w-full max-w-[340px] flex flex-col items-center gap-6">
								<span class="text-[13px] font-bold text-white/50 text-center leading-relaxed">
									{t('valuation.save_instruction') || 'لمس طولانی روی تصویر برای ذخیره در گالری\n(Long press the image to save to gallery)'}
								</span>

								{/* Generated Image Preview Container */}
								<div class="w-full aspect-square bg-[#0c0d10] border border-white/[0.08] rounded-[36px] shadow-2xl overflow-hidden p-[1.5px] bg-gradient-to-br from-cyan-400 via-purple-600 to-pink-500">
									<img 
										src={generatedImg()} 
										alt="Username Card" 
										class="w-full h-full object-cover rounded-[35px] select-none"
										onContextMenu={(e) => e.stopPropagation()} // Allow native context menu for saving
									/>
								</div>

								<button 
									onClick={() => setShowModal(false)}
									class="w-full h-12 bg-white/[0.06] hover:bg-white/[0.1] active:scale-95 text-white font-bold rounded-2xl flex items-center justify-center transition-all text-[14px] cursor-pointer"
								>
									{t('valuation.close') || 'بستن (Close)'}
								</button>
							</div>
						</div>
					</Show>
				</div>
			</Show>

			{/* Hidden Card for clean, crop-free image rendering */}
			<div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '400px', height: '400px' }}>
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
								<span class="text-[26px] sm:text-[28px] font-black text-white leading-none drop-shadow-[0_0_15px_rgba(0,152,234,0.3)]">
									{parseFloat(data()?.expected_ton || '0').toLocaleString('en-US')}
								</span>
								<span class="text-[13px] font-bold text-[#3390ec] leading-none">TON</span>
							</div>
						</div>

						<div class="flex flex-col items-end gap-2">
							<div class="flex items-center gap-1.5 bg-[#00ff88]/10 px-3 py-1 rounded-full border border-[#00ff88]/30 text-[#00ff88] font-black uppercase tracking-wider text-[9px] shadow-[0_0_15px_rgba(0,255,136,0.15)]">
								<div class="w-1.5 h-1.5 bg-[#00ff88] rounded-full animate-pulse shadow-[0_0_8px_#00ff88]" />
								Valued
							</div>
							<span class="text-[13px] text-white/60 font-black leading-none">
								≈ ${parseFloat(data()?.expected_usd || '0').toLocaleString('en-US', { maximumFractionDigits: 0 })}
							</span>
						</div>
					</div>
				</div>
			</div>
		</Show>
	);
};

export default UsernamePage;
