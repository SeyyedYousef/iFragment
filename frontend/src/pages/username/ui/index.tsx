import { backButton, hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createSignal, createEffect, onCleanup, onMount, Show } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { Motion } from '@motionone/solid';
import { apiFetch } from '@/shared/api/base.js';
import { valuationApi } from '@/shared/api/bot-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
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
		transactions?: {
			sale_price_ton: string;
			date: string;
			buyer: string;
		}[];
	};
	similar: {
		username: string;
		reason: string;
		status?: string;
		sale_price?: number;
		sale_price_usd?: number;
		sale_date?: string;
	}[];
	portfolio?: {
		owner_address: string;
		total_count: number;
		total_spent_ton: number;
		total_spent_usd: number;
		total_value_ton: number;
		items: {
			username: string;
			sold_price?: number;
			sale_date?: string;
			status: string;
		}[];
	};
	owner_profile?: {
		user_id?: number;
		first_name?: string;
		last_name?: string;
		username?: string;
		is_premium?: boolean;
		has_photo?: boolean;
		peer_type?: string;
	};
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
	investment_grade: string;
	comparables: {
		username: string;
		price: number;
		date: string;
	}[];
	price_trend: {
		label: string;
		value: number;
	}[];
	wallet_info?: {
		balance: number;
		nft_count: number;
		is_whale: boolean;
	};
	entity_info?: {
		type: string;
		members: number;
		verified: boolean;
	};
	status?: string;
	brandability: number;
	fear_greed_index: number;
	fear_greed_label: string;
	wikipedia_summary: string;
	rarity_breakdown: Record<string, number>;
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

	// Payment Gate State
	const [accessGranted, setAccessGranted] = createSignal<boolean>(false);
	const [accessMethod, setAccessMethod] = createSignal<'free' | 'stars' | 'coins' | null>(null);
	const [showPaymentGate, setShowPaymentGate] = createSignal<boolean>(false);
	const [freeQuotaUsed, setFreeQuotaUsed] = createSignal<boolean>(false);
	const [isProcessingPayment, setIsProcessingPayment] = createSignal<boolean>(false);
	const [paymentError, setPaymentError] = createSignal<string>('');

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
			return 'from-emerald-400/20 to-teal-500/10 border-emerald-400/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]';
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
			return 'from-emerald-300 via-teal-400 to-cyan-500';
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

	const grantAccess = (method: 'free' | 'stars' | 'coins', targetUser: string) => {
		try {
			localStorage.setItem(`val_access_${targetUser}`, method);
		} catch (_) {}
		setAccessMethod(method);
		setAccessGranted(true);
		setShowPaymentGate(false);
		fetchValuation(targetUser);
	};

	const fetchValuation = async (u: string) => {
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

	const handlePayStars = async () => {
		const u = username();
		if (!u || isProcessingPayment()) return;
		setIsProcessingPayment(true);
		setPaymentError('');

		try {
			const res = await valuationApi.createStarsInvoice(u);
			if (res && res.invoice_link) {
				const tg = (window as any).Telegram?.WebApp;
				if (tg?.openInvoice) {
					tg.openInvoice(res.invoice_link, (status: string) => {
						if (status === 'paid') {
							hapticFeedback.notificationOccurred('success');
							grantAccess('stars', u);
						}
					});
				} else {
					openTelegramLink(res.invoice_link);
					grantAccess('stars', u);
				}
			} else {
				grantAccess('stars', u);
			}
		} catch (e: any) {
			setPaymentError(e?.message || t('valuation.err_server') || 'Payment failed');
			hapticFeedback.notificationOccurred('error');
		} finally {
			setIsProcessingPayment(false);
		}
	};

	const handlePayCoins = async () => {
		const u = username();
		if (!u || isProcessingPayment()) return;
		setIsProcessingPayment(true);
		setPaymentError('');

		try {
			const res = await valuationApi.payWithAirdrop(u);
			if (res && res.success) {
				hapticFeedback.notificationOccurred('success');
				grantAccess('coins', u);
			} else {
				grantAccess('coins', u);
			}
		} catch (e: any) {
			const msg = e?.response?.data?.error || e?.message || 'Insufficient coin balance';
			setPaymentError(msg);
			hapticFeedback.notificationOccurred('error');
		} finally {
			setIsProcessingPayment(false);
		}
	};

	const handleVerifyFreeAccess = async () => {
		const u = username();
		if (!u || isProcessingPayment()) return;
		if (freeQuotaUsed()) {
			setPaymentError(t('valuation.free_quota_used') || 'Your 1-time free valuation quota has been used.');
			hapticFeedback.notificationOccurred('error');
			return;
		}

		setIsProcessingPayment(true);
		setPaymentError('');

		try {
			const res = await valuationApi.verifyFreeAccess(u);
			if (res && res.has_access) {
				hapticFeedback.notificationOccurred('success');
				localStorage.setItem('val_free_used', 'true');
				setFreeQuotaUsed(true);
				grantAccess('free', u);
			} else {
				openTelegramLink('https://t.me/FragmentsCommunity');
				setTimeout(() => openTelegramLink('https://t.me/FragmentInvestors'), 400);
				localStorage.setItem('val_free_used', 'true');
				setFreeQuotaUsed(true);
				grantAccess('free', u);
			}
		} catch (e: any) {
			openTelegramLink('https://t.me/FragmentsCommunity');
			setTimeout(() => openTelegramLink('https://t.me/FragmentInvestors'), 400);
			localStorage.setItem('val_free_used', 'true');
			setFreeQuotaUsed(true);
			grantAccess('free', u);
		} finally {
			setIsProcessingPayment(false);
		}
	};

	createEffect(() => {
		const initValuation = async () => {
			const u = username();
			if (!u) return;

			setLoading(true);
			setError(null);

			const cachedAccess = localStorage.getItem(`val_access_${u}`);
			const freeUsed = localStorage.getItem('val_free_used') === 'true';
			setFreeQuotaUsed(freeUsed);

			if (cachedAccess) {
				setAccessGranted(true);
				setAccessMethod(cachedAccess as any);
				fetchValuation(u);
			} else {
				try {
					const accessRes = await valuationApi.checkAccess(u);
					if (accessRes && accessRes.has_access) {
						setAccessGranted(true);
						setAccessMethod(accessRes.method || 'stars');
						fetchValuation(u);
					} else {
						if (accessRes?.free_quota_used) {
							setFreeQuotaUsed(true);
							localStorage.setItem('val_free_used', 'true');
						}
						setShowPaymentGate(true);
						setLoading(false);
					}
				} catch (_) {
					setShowPaymentGate(true);
					setLoading(false);
				}
			}
		};

		initValuation();
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
					{/* Access Method Audit Badge / Notification */}
					<Show when={accessMethod()}>
						<div class="w-full max-w-[400px] mb-4 bg-gradient-to-r from-[#161922] to-[#0d0f17] border border-white/10 rounded-2xl p-3.5 flex items-center justify-between shadow-xl">
							<div class="flex items-center gap-3">
								<div class={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${accessMethod() === 'stars' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : accessMethod() === 'coins' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
									{accessMethod() === 'stars' ? '⭐' : accessMethod() === 'coins' ? '🪙' : '🎁'}
								</div>
								<div class="flex flex-col text-left">
									<span class="text-[9px] text-white/40 uppercase font-black tracking-wider">{t('valuation.payment_method_badge')}</span>
									<span class="text-[12px] font-bold text-white">
										{accessMethod() === 'stars' ? t('valuation.method_stars') : accessMethod() === 'coins' ? t('valuation.method_coins') : t('valuation.method_free')}
									</span>
								</div>
							</div>
							<span class="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black uppercase tracking-wider">VERIFIED</span>
						</div>
					</Show>

					{/* Flex Card Container Wrapper (Gradient Border) */}
					<div 
						class="w-full max-w-[400px] aspect-square p-[1.5px] bg-gradient-to-br from-cyan-400 via-teal-500 to-emerald-400 rounded-[42px] shadow-[0_30px_70px_rgba(0,0,0,0.85),0_0_40px_rgba(20,184,166,0.15)] transition-all duration-300 hover:shadow-[0_40px_80px_rgba(0,0,0,0.95),0_0_60px_rgba(0,245,255,0.25)] mb-4"
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
									<span class="text-[13px] text-white/60 font-black leading-none" style={{ "font-family": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
										≈ ${parseFloat(data()?.expected_usd || '0').toLocaleString('en-US', { maximumFractionDigits: 0 })}
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

					{/* Valuation Metrics (Price Range) */}
					<div class="w-full max-w-[400px] mt-8 flex flex-col gap-4">

						{/* Price Range */}
						<div class="bg-[#0e1118] border border-white/[0.08] rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
							<div class="flex items-center justify-between text-white/90">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-[20px] text-[#0098ea]">monitoring</span>
									<span class="text-sm font-semibold uppercase tracking-wider">{t('valuation.price_range') || 'Price Range'}</span>
								</div>
								<span class="text-xs text-white/40">{t('valuation.market_estimation') || 'Market Estimation'}</span>
							</div>
							
							<div class="relative w-full h-2.5 bg-white/5 rounded-full overflow-hidden flex">
								<div class="h-full bg-gradient-to-r from-[#0098ea]/20 to-[#0098ea] rounded-l-full" style={{ "width": "30%" }} />
								<div class="h-full bg-[#0098ea] relative" style={{ "width": "40%" }} />
								<div class="h-full bg-gradient-to-r from-[#0098ea] to-emerald-500/20 rounded-r-full" style={{ "width": "30%" }} />
								<div class="absolute top-0 bottom-0 w-0.5 bg-white left-[50%] -translate-x-1/2 shadow-[0_0_8px_white]" />
							</div>
							
							<div class="flex justify-between items-center w-full mt-1">
								<div class="flex flex-col text-left opacity-50 scale-90 origin-left">
									<span class="text-white/40 text-[9px] uppercase font-bold tracking-wider mb-0.5">{t('valuation.floor') || 'Low End'}</span>
									<span class="text-white font-mono text-xs">{parseFloat(data()?.low_ton || '0').toLocaleString('en-US')} TON</span>
								</div>
								<div class="flex flex-col text-center scale-105 origin-center bg-[#141824] border border-[#232a3d] rounded-xl px-4 py-2">
									<span class="text-[#0098ea] text-[9px] uppercase font-bold tracking-widest mb-0.5">{t('valuation.expected_label') || 'Expected'}</span>
									<span class="text-white font-mono font-bold text-base">{parseFloat(data()?.expected_ton || '0').toLocaleString('en-US')} TON</span>
								</div>
								<div class="flex flex-col text-right opacity-50 scale-90 origin-right">
									<span class="text-white/40 text-[9px] uppercase font-bold tracking-wider mb-0.5">{t('valuation.ceiling') || 'High End'}</span>
									<span class="text-white font-mono text-xs">{parseFloat(data()?.high_ton || '0').toLocaleString('en-US')} TON</span>
								</div>
							</div>
						</div>

						{/* AI Valuation Factors */}
						<Show when={data()?.tags && data()!.tags.length > 0}>
							<div class="bg-[#0e1118] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3">
								<div class="flex items-center gap-2 text-white/90">
									<span class="material-symbols-outlined text-[20px] text-[#0098ea]">auto_awesome</span>
									<span class="text-sm font-semibold uppercase tracking-wider">{t('valuation.ai_factors') || 'AI Valuation Factors'}</span>
								</div>
								<div class="flex flex-wrap gap-2 mt-1">
									{data()?.tags?.map((tag) => (
										<span class="bg-[#141824] border border-[#232a3d] text-white/80 text-xs px-2.5 py-1 rounded-lg">
											{tag}
										</span>
									))}
								</div>
							</div>
						</Show>
						
						{/* Extended Reasoning Log */}
						<Show when={data()?.reasoning_log?.AI_Reasoning}>
							<div class="bg-[#0e1118] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3">
								<div class="flex items-center gap-2 text-white/90">
									<span class="material-symbols-outlined text-[20px] text-emerald-400">psychology_alt</span>
									<span class="text-sm font-semibold uppercase tracking-wider">{t('valuation.ai_reasoning') || 'AI Reasoning'}</span>
								</div>
								<div class="text-white/60 text-xs leading-relaxed whitespace-pre-line border-l-2 border-emerald-500/40 pl-3">
									"{data()?.reasoning_log?.AI_Reasoning}"
								</div>
							</div>
						</Show>
					</div>

					{/* Reports Section (Fragment Minimal Style) */}
					<div class="w-full max-w-[400px] mt-6 flex flex-col gap-4 border-t border-white/[0.08] pt-6 pb-6">

						{/* Ownership History */}
						<div class="bg-[#0e1118] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3">
							<div class="flex items-center gap-2 text-white/90 mb-2">
								<span class="material-symbols-outlined text-[20px] text-[#0098ea]">history</span>
								<span class="text-sm font-semibold uppercase tracking-wider">{t('valuation.history_title') || 'Ownership History'}</span>
							</div>
							<Show
								when={data()?.history?.is_sold || ((data()?.history?.transactions?.length ?? 0) > 0)}
								fallback={
									<div class="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5">
										<span class="material-symbols-outlined text-emerald-400">verified</span>
										<span class="text-emerald-400 text-xs font-medium">{t('valuation.not_sold') || 'Status: Never sold on Fragment!'}</span>
									</div>
								}
							>
								<div class="flex flex-col rounded-xl overflow-hidden bg-[#0a0c12] border border-white/[0.06]">
									<div class="grid grid-cols-3 p-3 border-b border-white/[0.06] bg-white/[0.02] text-xs font-semibold text-white/40 uppercase">
										<span>{t('valuation.sale_price') || 'Sale price'}</span>
										<span>{t('valuation.date') || 'Date'}</span>
										<span class="text-right">{t('valuation.buyer') || 'Buyer'}</span>
									</div>
									<Show when={(data()?.history?.transactions?.length ?? 0) > 0} fallback={
										<div class="p-4 text-center text-white/40 text-xs">{t('valuation.no_tx') || 'No transaction details available.'}</div>
									}>
										<div class="flex flex-col">
											{data()?.history?.transactions?.map((tx, idx) => (
												<div class={`grid grid-cols-3 p-3 items-center text-xs ${idx !== (data()?.history?.transactions?.length || 0) - 1 ? 'border-b border-white/[0.06]' : ''}`}>
													<span class="text-white font-mono font-semibold">{tx.sale_price_ton} TON</span>
													<span class="text-white/40 text-[11px]">{new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
													<span class="text-[#0098ea] font-mono font-medium text-[11px] truncate text-right">{tx.buyer ? `${tx.buyer.slice(0, 6)}...${tx.buyer.slice(-4)}` : 'Fragment'}</span>
												</div>
											))}
										</div>
									</Show>
								</div>
							</Show>
						</div>

						{/* AI Suggestions with Status & Prices */}
						<Show when={(data()?.similar?.length ?? 0) > 0}>
							<div class="bg-[#0e1118] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3">
								<div class="flex items-center justify-between text-white/90 mb-1">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-[20px] text-amber-400">grid_view</span>
										<span class="text-sm font-semibold uppercase tracking-wider">{t('valuation.similar_title') || 'Similar Usernames'}</span>
									</div>
									<span class="text-xs text-white/40">{data()?.similar?.length} items</span>
								</div>
								<div class="flex gap-3 overflow-x-auto pb-2 snap-x hide-scrollbar">
									{data()?.similar?.map(sim => {
										const getStatusBadge = (status?: string) => {
											switch (status) {
												case 'sold':
													return { text: 'Sold', bg: 'bg-white/10 text-white/70' };
												case 'on_sale':
													return { text: 'On Sale', bg: 'bg-[#0098ea]/20 text-[#0098ea] border border-[#0098ea]/30' };
												case 'available':
													return { text: 'Available', bg: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' };
												default:
													return { text: 'Non-NFT', bg: 'bg-zinc-800 text-zinc-400' };
											}
										};
										const badge = getStatusBadge(sim.status);

										return (
											<div class="min-w-[200px] flex-shrink-0 bg-[#0a0c12] border border-white/[0.06] rounded-xl p-3 snap-start cursor-pointer hover:bg-white/[0.03] transition-all flex flex-col justify-between gap-2"
												onClick={() => {
													window.location.href = `/username?u=${sim.username}`;
												}}
											>
												<div class="flex items-center justify-between gap-2">
													<div class="text-[#0098ea] font-bold truncate">@{sim.username}</div>
													<span class={`text-[9px] font-bold px-2 py-0.5 rounded-full ${badge.bg}`}>
														{badge.text}
													</span>
												</div>
												<div class="text-white/40 text-xs line-clamp-2 leading-relaxed">{sim.reason}</div>
												<Show when={sim.sale_price}>
													<div class="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs">
														<span class="text-white/40">Price</span>
														<span class="text-emerald-400 font-mono font-bold">{sim.sale_price?.toLocaleString()} TON</span>
													</div>
												</Show>
											</div>
										);
									})}
								</div>
							</div>
						</Show>

						{/* Username Portfolio Section */}
						<Show when={data()?.portfolio && (data()?.portfolio?.items?.length ?? 0) > 0}>
							<div class="bg-[#0e1118] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3">
								<div class="flex items-center justify-between text-white/90 mb-1">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-[20px] text-purple-400">folder_special</span>
										<span class="text-sm font-semibold uppercase tracking-wider">{t('valuation.portfolio_title') || 'Username Portfolio'}</span>
									</div>
									<span class="text-xs text-purple-400 font-bold px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
										{data()?.portfolio?.total_count} Handles
									</span>
								</div>

								<div class="text-xs text-white/30 font-mono truncate">
									Owner: {data()?.portfolio?.owner_address}
								</div>

								<div class="flex flex-col rounded-xl overflow-hidden bg-[#0a0c12] border border-white/[0.06]">
									<div class="grid grid-cols-2 p-3 border-b border-white/[0.06] bg-white/[0.02] text-xs font-semibold text-white/40 uppercase">
										<span>Username</span>
										<span class="text-right">{t('valuation.est_status') || 'Est. / Status'}</span>
									</div>
									<div class="flex flex-col max-h-[220px] overflow-y-auto hide-scrollbar">
										{data()?.portfolio?.items?.slice(0, 10).map(item => (
											<div class="grid grid-cols-2 p-3 items-center border-b border-white/[0.06] text-xs hover:bg-white/[0.02] cursor-pointer"
												onClick={() => window.location.href = `/username?u=${item.username}`}
											>
												<span class="text-[#0098ea] font-bold truncate">@{item.username}</span>
												<span class="text-right text-xs text-white/50 font-mono">
													{item.sold_price ? `${item.sold_price} TON` : item.status}
												</span>
											</div>
										))}
									</div>
								</div>

								<Show when={data()?.portfolio?.total_value_ton}>
									<div class="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-between text-xs">
										<span class="text-purple-300 font-medium">{t('valuation.est_portfolio_val') || 'Est. Portfolio Value'}</span>
										<span class="text-purple-400 font-mono font-bold text-sm">
											{data()?.portfolio?.total_value_ton?.toLocaleString()} TON
										</span>
									</div>
								</Show>
							</div>
						</Show>

						{/* Owner Profile / Contact Section */}
						<Show when={data()?.owner_profile?.first_name || data()?.owner_profile?.username}>
							<div class="bg-[#0e1118] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3">
								<div class="flex items-center gap-2 text-white/90 mb-1">
									<span class="material-symbols-outlined text-[20px] text-[#0098ea]">account_circle</span>
									<span class="text-sm font-semibold uppercase tracking-wider">{t('valuation.owner_profile_title') || 'Owner Profile'}</span>
								</div>
								<div class="flex items-center gap-3 p-3 bg-[#0a0c12] rounded-xl border border-white/[0.06]">
									<div class="w-10 h-10 rounded-full bg-[#0098ea]/20 text-[#0098ea] flex items-center justify-center font-bold text-base">
										{data()?.owner_profile?.first_name?.[0] || 'U'}
									</div>
									<div class="flex flex-col">
										<span class="text-white font-bold text-sm">
											{data()?.owner_profile?.first_name} {data()?.owner_profile?.last_name || ''}
										</span>
										<Show when={data()?.owner_profile?.username}>
											<a href={`https://t.me/${data()?.owner_profile?.username}`} target="_blank" class="text-[#0098ea] text-xs font-medium">
												@{data()?.owner_profile?.username}
											</a>
										</Show>
									</div>
								</div>
							</div>
						</Show>

						{/* Identity & Linguistics */}
						<div class="bg-[#0e1118] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3">
							<div class="flex items-center gap-2 text-white/90 mb-1">
								<span class="material-symbols-outlined text-[20px] text-cyan-400">translate</span>
								<span class="text-sm font-semibold uppercase tracking-wider">{t('valuation.dict_title') || 'Identity & Linguistics'}</span>
							</div>
							<div class="flex items-center justify-between bg-[#0a0c12] rounded-xl p-3 border border-white/[0.04]">
								<span class="text-white/60 text-xs">{t('valuation.len')?.replace('{count}', data()?.length?.toString() || '0') || `Length: ${data()?.length} chars`}</span>
								<span class="text-white font-mono text-xs">{data()?.length}</span>
							</div>
							<Show
								when={data()?.dictionary?.is_word}
								fallback={
									<div class="flex items-center justify-center bg-[#0a0c12] rounded-xl p-3.5 border border-white/[0.04]">
										<span class="text-white/30 text-xs italic">{t('valuation.dict_none') || 'Not a dictionary word'}</span>
									</div>
								}
							>
								<div class="flex flex-col bg-[#0a0c12] rounded-xl p-3 border border-white/[0.04]">
									<span class="text-cyan-400 text-xs font-bold uppercase mb-1">
										{data()?.dictionary?.part_of_speech || (t('valuation.unknown') || 'Unknown')}
									</span>
									<span class="text-white/70 text-xs leading-relaxed">{data()?.dictionary?.definition}</span>
								</div>
							</Show>
						</div>

						{/* Structural Anatomy — Username DNA */}
						<div class="bg-[#0e1118] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3">
							<div class="flex items-center gap-2 text-white/90 mb-1">
								<span class="material-symbols-outlined text-[20px] text-pink-400">biotech</span>
								<span class="text-sm font-semibold uppercase tracking-wider">{t('valuation.struct_title') || 'Username DNA'}</span>
							</div>
							
							{/* Pure Letters (No numbers) */}
							<div class="flex items-center justify-between bg-[#0a0c12] rounded-xl p-3 border border-white/[0.04]">
								<div class="flex flex-col gap-0.5">
									<span class="text-white/80 text-xs font-medium">{t('valuation.has_digits_title') || 'Pure Letters'}</span>
									<span class="text-white/30 text-[10px]">{data()?.structure?.has_digits ? (t('valuation.has_digits_desc') || 'Alpha-numeric combination') : (t('valuation.no_digits_desc') || 'Contains no numbers')}</span>
								</div>
								<Show when={!data()?.structure?.has_digits} fallback={
									<span class="bg-red-500/15 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/20">{t('valuation.badge_avoid') || 'AVOID'}</span>
								}>
									<span class="bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/20">{t('valuation.badge_premium') || 'PREMIUM'}</span>
								</Show>
							</div>

							{/* Clean Handle (No underscore) */}
							<div class="flex items-center justify-between bg-[#0a0c12] rounded-xl p-3 border border-white/[0.04]">
								<div class="flex flex-col gap-0.5">
									<span class="text-white/80 text-xs font-medium">{t('valuation.has_underscore_title') || 'Clean Handle'}</span>
									<span class="text-white/30 text-[10px]">{data()?.structure?.has_underscore ? (t('valuation.has_underscore_desc') || 'Contains underscore') : (t('valuation.no_underscore_desc') || 'Clean, unbroken format')}</span>
								</div>
								<Show when={!data()?.structure?.has_underscore} fallback={
									<span class="bg-red-500/15 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/20">{t('valuation.badge_avoid') || 'AVOID'}</span>
								}>
									<span class="bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/20">{t('valuation.badge_clean') || 'CLEAN'}</span>
								</Show>
							</div>

							{/* Letters Only */}
							<div class="flex items-center justify-between bg-[#0a0c12] rounded-xl p-3 border border-white/[0.04]">
								<div class="flex flex-col gap-0.5">
									<span class="text-white/80 text-xs font-medium">{t('valuation.letters_only_title') || 'Alpha-Only'}</span>
									<span class="text-white/30 text-[10px]">{data()?.structure?.letters_only ? (t('valuation.letters_only_desc') || 'Pure alphabetic characters') : (t('valuation.mixed_chars_desc') || 'Contains mixed characters')}</span>
								</div>
								<Show when={data()?.structure?.letters_only} fallback={
									<span class="bg-white/5 text-white/40 text-[10px] font-bold px-2 py-0.5 rounded border border-white/10">{t('valuation.badge_mixed') || 'MIXED'}</span>
								}>
									<span class="bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/20">{t('valuation.badge_premium') || 'PREMIUM'}</span>
								</Show>
							</div>

							{/* Dictionary Word */}
							<div class="flex items-center justify-between bg-[#0a0c12] rounded-xl p-3 border border-white/[0.04]">
								<div class="flex flex-col gap-0.5">
									<span class="text-white/80 text-xs font-medium">{t('valuation.dict_word_title') || 'Dictionary Word'}</span>
									<span class="text-white/30 text-[10px]">{data()?.dictionary?.is_word ? (t('valuation.dict_word_desc') || 'Recognized semantic word') : (t('valuation.not_dict_word_desc') || 'Not found in dictionary')}</span>
								</div>
								<Show when={data()?.dictionary?.is_word} fallback={
									<span class="bg-white/5 text-white/40 text-[10px] font-bold px-2 py-0.5 rounded border border-white/10">{t('valuation.badge_no') || 'NO'}</span>
								}>
									<span class="bg-cyan-500/15 text-cyan-400 text-[10px] font-bold px-2 py-0.5 rounded border border-cyan-500/20">{t('valuation.badge_yes') || 'YES'}</span>
								</Show>
							</div>

							{/* Character Length */}
							<div class="flex items-center justify-between bg-[#0a0c12] rounded-xl p-3 border border-white/[0.04]">
								<div class="flex flex-col gap-0.5">
									<span class="text-white/80 text-xs font-medium">{t('valuation.len_title') || 'Length'}</span>
									<span class="text-white/30 text-[10px]">{(data()?.length || 0) <= 4 ? (t('valuation.len_ultra_short') || 'Ultra-short format') : (data()?.length || 0) <= 6 ? (t('valuation.len_short') || 'Short format') : (t('valuation.len_standard') || 'Standard length')}</span>
								</div>
								<span class={`text-[10px] font-bold px-2 py-0.5 rounded border ${(data()?.length || 0) <= 4 ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : (data()?.length || 0) <= 6 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-white/40 border-white/10'}`}>
									{data()?.length} {t('valuation.chars_suffix') || 'CHARS'}
								</span>
							</div>
						</div>

						{/* Brandability & Investment Grade */}
						<div class="grid grid-cols-2 gap-3">
							<div class="bg-[#0e1118] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-2 justify-center items-center text-center">
								<span class="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">{t('valuation.brandability') || 'Brandability'}</span>
								<div class="relative w-12 h-12 flex items-center justify-center">
									<svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
										<path class="text-white/10" stroke-width="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
										<path class="text-pink-400" stroke-dasharray={`${data()?.brandability || 0}, 100`} stroke-width="4" stroke-linecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
									</svg>
									<span class="absolute text-white font-bold text-xs">{data()?.brandability || 0}</span>
								</div>
							</div>
							
							<div class="bg-[#0e1118] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-2 justify-center items-center text-center">
								<span class="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">{t('valuation.investment_grade') || 'Investment Grade'}</span>
								<span class="text-2xl font-black text-emerald-400">{data()?.investment_grade || 'C'}</span>
							</div>
						</div>

						{/* Bottom Section: Confidence & Model Engine */}
						<div class="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/[0.08]">
							<div class="bg-[#0e1118] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-2">
								<span class="text-white/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[14px]">radar</span> 
									{t('valuation.confidence') || 'Confidence'}
								</span>
								<div class="flex items-end gap-1.5 mt-1">
									<span class={`text-xl font-black leading-none ${data()?.confidence_score && data()!.confidence_score >= 80 ? 'text-emerald-400' : data()?.confidence_score && data()!.confidence_score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
										{data()?.confidence_score || 0}%
									</span>
								</div>
								<div class="w-full h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
									<div class={`h-full ${data()?.confidence_score && data()!.confidence_score >= 80 ? 'bg-emerald-400' : data()?.confidence_score && data()!.confidence_score >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ "width": `${data()?.confidence_score || 0}%` }} />
								</div>
							</div>
							
							<div class="bg-[#0e1118] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-2">
								<span class="text-white/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[14px]">memory</span> 
									{t('valuation.engine') || 'Engine'}
								</span>
								<span class="text-white font-bold text-xs mt-1">{data()?.model_version || 'AVM-v2'}</span>
								<span class="text-white/30 text-[10px]">{t('valuation.datapoints') || 'Data points'}: {data()?.comparable_sales_count || 0}</span>
							</div>
						</div>

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
							<span class="text-[13px] text-white/60 font-black leading-none" style={{ "font-family": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
								≈ ${parseFloat(data()?.expected_usd || '0').toLocaleString('en-US', { maximumFractionDigits: 0 })}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Semi-Paid Valuation Bottom Sheet Modal */}
			<Show when={showPaymentGate()}>
				<Motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					class={`fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-end justify-center ${isRtl() ? 'rtl' : 'ltr'}`}
				>
					<Motion.div
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						transition={{ duration: 0.35, easing: [0.32, 0.72, 0, 1] }}
						class="w-full max-h-[90vh] bg-[#14151a] rounded-t-[2.5rem] border-t border-white/10 p-6 overflow-y-auto no-scrollbar shadow-[0_-20px_50px_rgba(0,0,0,0.9)] relative"
					>
						{/* Handle */}
						<div class="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5" />

						{/* Header Premium Badge */}
						<div class="flex flex-col items-center text-center gap-2 mb-6">
							<div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/20 via-cyan-400/20 to-blue-500/20 border border-amber-400/30 flex items-center justify-center shadow-[0_0_25px_rgba(251,191,36,0.2)] mb-1">
								<span class="material-symbols-outlined text-[32px] text-amber-400">workspace_premium</span>
							</div>
							<h3 class="text-[20px] font-black text-white leading-tight">
								{t('valuation.gate_title')}
							</h3>
							<p class="text-[13px] font-medium text-white/50 max-w-xs leading-relaxed">
								{t('valuation.gate_subtitle')}
							</p>
						</div>

						{/* Error Message */}
						<Show when={paymentError()}>
							<div class="bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-3.5 mb-4 text-xs font-bold flex items-center gap-2">
								<span class="material-symbols-outlined text-[18px]">error</span>
								<span>{paymentError()}</span>
							</div>
						</Show>

						{/* Options List */}
						<div class="space-y-3.5">
							{/* Option 1: Telegram Stars */}
							<button
								onClick={handlePayStars}
								disabled={isProcessingPayment()}
								class="w-full relative group overflow-hidden bg-gradient-to-r from-[#21232d] to-[#171820] border border-amber-400/30 hover:border-amber-400/60 rounded-3xl p-4 text-left transition-all active:scale-[0.98] disabled:opacity-50"
							>
								<div class="absolute right-[-20px] top-[-20px] w-24 h-24 bg-amber-400/10 rounded-full blur-2xl group-hover:bg-amber-400/20 transition-all" />
								<div class="relative flex items-center gap-3.5 z-10">
									<div class="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner text-2xl">
										⭐
									</div>
									<div class="flex-1 flex flex-col items-start text-left">
										<h4 class="text-[15px] font-black text-white leading-tight">
											{t('valuation.pay_stars_title')}
										</h4>
										<span class="text-[12px] font-medium text-white/50 mt-0.5">
											{t('valuation.pay_stars_desc')}
										</span>
									</div>
									<div class="px-3 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-400 font-black text-xs">
										49 ⭐
									</div>
								</div>
							</button>

							{/* Option 2: Airdrop Coins */}
							<button
								onClick={handlePayCoins}
								disabled={isProcessingPayment()}
								class="w-full relative group overflow-hidden bg-gradient-to-r from-[#21232d] to-[#171820] border border-cyan-400/30 hover:border-cyan-400/60 rounded-3xl p-4 text-left transition-all active:scale-[0.98] disabled:opacity-50"
							>
								<div class="absolute right-[-20px] top-[-20px] w-24 h-24 bg-cyan-400/10 rounded-full blur-2xl group-hover:bg-cyan-400/20 transition-all" />
								<div class="relative flex items-center gap-3.5 z-10">
									<div class="w-12 h-12 rounded-2xl bg-cyan-400/15 border border-cyan-400/30 flex items-center justify-center shrink-0 shadow-inner">
										<span class="material-symbols-outlined text-cyan-400 text-[26px]">toll</span>
									</div>
									<div class="flex-1 flex flex-col items-start text-left">
										<h4 class="text-[15px] font-black text-white leading-tight">
											{t('valuation.pay_coins_title')}
										</h4>
										<span class="text-[12px] font-medium text-white/50 mt-0.5">
											{t('valuation.pay_coins_desc')}
										</span>
									</div>
									<div class="px-3 py-1.5 rounded-full bg-cyan-400/15 border border-cyan-400/30 text-cyan-400 font-black text-xs">
										88,000 🪙
									</div>
								</div>
							</button>

							{/* Option 3: 1-Time Free Lifetime Access (Community Channels Join) — Hidden permanently once used */}
							<Show when={!freeQuotaUsed()}>
								<div class="w-full bg-gradient-to-r from-[#1b251e] to-[#131b15] border border-emerald-500/40 rounded-3xl p-4 flex flex-col gap-3 transition-all">
									<div class="flex items-center gap-3.5">
										<div class="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner text-2xl">
											🎁
										</div>
										<div class="flex-1 flex flex-col text-left">
											<div class="flex items-center justify-between">
												<h4 class="text-[15px] font-black text-white leading-tight">
													{t('valuation.free_channel_group_title')}
												</h4>
											</div>
											<span class="text-[12px] font-medium text-white/50 mt-0.5">
												{t('valuation.free_channel_group_desc')}
											</span>
										</div>
									</div>

									{/* Dual Buttons Side-by-Side: Join Channel & Join Group */}
									<div class="grid grid-cols-2 gap-2 w-full pt-1">
										<button
											onClick={() => openTelegramLink('https://t.me/FragmentsCommunity')}
											class="h-10 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95"
										>
											<span class="material-symbols-outlined text-[16px] text-emerald-400">podcasts</span>
											<span>{t('valuation.join_channel_btn')}</span>
										</button>
										<button
											onClick={() => openTelegramLink('https://t.me/FragmentInvestors')}
											class="h-10 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95"
										>
											<span class="material-symbols-outlined text-[16px] text-emerald-400">group</span>
											<span>{t('valuation.join_group_btn')}</span>
										</button>
									</div>

									{/* Full-width Verify & Analyze Button Below */}
									<button
										onClick={handleVerifyFreeAccess}
										disabled={isProcessingPayment()}
										class="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-50 mt-1"
									>
										<Show when={isProcessingPayment()} fallback={
											<>
												<span class="material-symbols-outlined text-[18px]">verified</span>
												<span>{t('valuation.verify_membership_btn')}</span>
											</>
										}>
											<div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
										</Show>
									</button>
								</div>
							</Show>
						</div>

						{/* Processing Overlay */}
						<Show when={isProcessingPayment()}>
							<div class="absolute inset-0 bg-[#14151a]/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center rounded-t-[2.5rem]">
								<span class="w-10 h-10 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mb-4" />
								<span class="text-[14px] font-bold text-white animate-pulse">Processing...</span>
							</div>
						</Show>
					</Motion.div>
				</Motion.div>
			</Show>
		</Show>
	);
};

export default UsernamePage;
