import { Motion } from '@motionone/solid';
import { useSearchParams } from '@solidjs/router';
import { backButton, hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { toPng } from 'html-to-image';
import { Component, createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { apiFetch } from '@/shared/api/base.js';
import { valuationApi } from '@/shared/api/bot-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { cloudStorage } from '@/shared/lib/cloud-storage.js';
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
	liquidity_rating?: string;
	estimated_sell_time?: string;
	target_buyer_profile?: string;
	projected_growth?: {
		bull_ton: number;
		base_ton: number;
		bear_ton: number;
		bull_usd: number;
		base_usd: number;
		bear_usd: number;
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

	const [_accessGranted, setAccessGranted] = createSignal<boolean>(false);
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
		setTilt({ x: ((rect.height / 2) - y) / 12, y: (x - (rect.width / 2)) / 12, glossX: (x / rect.width) * 100, glossY: (y / rect.height) * 100 });
	};
	const handleMouseLeave = () => setTilt({ x: 0, y: 0, glossX: 50, glossY: 50 });

	const getFontSize = (name: string) => {
		const len = name.length;
		if (len <= 5) return '46px';
		if (len <= 8) return '38px';
		if (len <= 12) return '30px';
		return '24px';
	};

	const getTierTheme = (tier: string) => {
		const t = (tier || '').toLowerCase();
		if (t.includes('legendary') || t.includes('grail')) return { wrapper: 'from-amber-400 via-orange-500 to-yellow-400 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_0_50px_rgba(245,158,11,0.25)]', badge: 'bg-amber-400/10 border-amber-400/30 text-amber-400', text: 'from-yellow-200 via-amber-400 to-yellow-500', glow: 'rgba(245,158,11,0.2)' };
		if (t.includes('epic') || t.includes('elite')) return { wrapper: 'from-cyan-400 via-blue-500 to-indigo-400 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_0_50px_rgba(59,130,246,0.25)]', badge: 'bg-blue-400/10 border-blue-400/30 text-blue-400', text: 'from-cyan-300 via-blue-400 to-indigo-400', glow: 'rgba(59,130,246,0.2)' };
		if (t.includes('rare') || t.includes('premium')) return { wrapper: 'from-emerald-400 via-teal-500 to-cyan-400 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_0_50px_rgba(16,185,129,0.25)]', badge: 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400', text: 'from-emerald-300 via-teal-400 to-cyan-400', glow: 'rgba(16,185,129,0.2)' };
		return { wrapper: 'from-slate-400 via-gray-500 to-slate-400 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_0_50px_rgba(148,163,184,0.15)]', badge: 'bg-slate-400/10 border-slate-400/30 text-slate-300', text: 'from-white via-slate-200 to-slate-400', glow: 'rgba(255,255,255,0.1)' };
	};

	const triggerAlert = (msg: string) => {
		const tg = (window as any).Telegram?.WebApp;
		tg?.showAlert ? tg.showAlert(msg) : alert(msg);
	};

	const handleSendToChat = async () => {
		if (!hiddenCardRef || downloading()) return;
		if (sendCount() >= 2) return triggerAlert(t('valuation.err_server') || 'Send limit reached.');
		setDownloading(true); setSent(false);
		try {
			try { hapticFeedback.impactOccurred('medium'); } catch (_) {}
			const dataUrl = await toPng(hiddenCardRef, { width: 400, height: 400, pixelRatio: 3 });
			const res = await apiFetch<{ success: boolean }>('/usernames/send-to-chat', { method: 'POST', body: JSON.stringify({ image: dataUrl }), headers: { 'Content-Type': 'application/json' } });
			if (res?.success) {
				try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
				setSent(true); setSendCount(c => c + 1); setTimeout(() => setSent(false), 3000);
			}
		} catch (err) {
			triggerAlert(t('valuation.err_server') || 'Failed to send.');
		} finally { setDownloading(false); }
	};

	const handleShareToStory = async () => {
		const u = data()?.username || username();
		if (!u || !hiddenCardRef || sharing()) return;
		setSharing(true);
		try {
			try { hapticFeedback.impactOccurred('medium'); } catch (_) {}
			const dataUrl = await toPng(hiddenCardRef, { width: 400, height: 400, pixelRatio: 3 });
			const res = await apiFetch<{ url: string }>('/usernames/share', { method: 'POST', body: JSON.stringify({ image: dataUrl }), headers: { 'Content-Type': 'application/json' } });
			if (res?.url) {
				shareToStory(res.url, { text: `Check out the market valuation of @${u} on iFragment! 💎`, widget_link: { url: `https://t.me/iFragmentBot/iFragment?startapp=val_${u}`, name: 'iFragment' } });
			}
		} catch (err) {} finally { setSharing(false); }
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} window.history.back(); });
		onCleanup(() => { off(); backButton.hide(); });
	});

	const grantAccess = (method: 'free' | 'stars' | 'coins', targetUser: string) => {
		try { localStorage.setItem(`val_access_${targetUser}`, method); } catch (_) {}
		setAccessMethod(method); setAccessGranted(true); setShowPaymentGate(false); fetchValuation(targetUser);
	};

	const fetchValuation = async (u: string) => {
		if (!u) return;
		setLoading(true); setError(null);
		try {
			const res = await apiFetch<ValuationResult>(`/usernames/valuate?u=${u}`);
			res ? setData(res) : setError(t('valuation.err_meta') || 'Failed to fetch metadata');
		} catch (err: any) {
			setError(err.message || t('valuation.err_server') || 'A server error occurred');
		} finally { setLoading(false); }
	};

	const handlePayStars = async () => {
		const u = username();
		if (!u || isProcessingPayment()) return;
		setIsProcessingPayment(true); setPaymentError('');
		try {
			const res = await valuationApi.createStarsInvoice(u);
			if (res?.invoice_link) {
				const tg = (window as any).Telegram?.WebApp;
				if (tg?.openInvoice) {
					tg.openInvoice(res.invoice_link, (status: string) => { if (status === 'paid') { hapticFeedback.notificationOccurred('success'); grantAccess('stars', u); } });
				} else { openTelegramLink(res.invoice_link); grantAccess('stars', u); }
			} else grantAccess('stars', u);
		} catch (e: any) {
			setPaymentError(e?.message || 'Payment failed'); hapticFeedback.notificationOccurred('error');
		} finally { setIsProcessingPayment(false); }
	};

	const handlePayCoins = async () => {
		const u = username();
		if (!u || isProcessingPayment()) return;
		setIsProcessingPayment(true); setPaymentError('');
		try {
			const res = await valuationApi.payWithAirdrop(u);
			if (res?.success) { hapticFeedback.notificationOccurred('success'); grantAccess('coins', u); }
			else grantAccess('coins', u);
		} catch (e: any) {
			setPaymentError(e?.response?.data?.error || e?.message || 'Insufficient coin balance'); hapticFeedback.notificationOccurred('error');
		} finally { setIsProcessingPayment(false); }
	};

	const handleVerifyFreeAccess = async () => {
		const u = username();
		if (!u || isProcessingPayment()) return;
		if (freeQuotaUsed()) { setPaymentError(t('valuation.free_quota_used') || 'Free quota used.'); hapticFeedback.notificationOccurred('error'); return; }
		setIsProcessingPayment(true); setPaymentError('');
		try {
			const res = await valuationApi.verifyFreeAccess(u);
			if (res?.has_access) {
				hapticFeedback.notificationOccurred('success');
				localStorage.setItem('val_free_used', 'true'); cloudStorage.setItem('val_free_used', 'true');
				setFreeQuotaUsed(true); grantAccess('free', u);
			} else {
				setPaymentError(t('valuation.free_quota_used') || 'Verification failed.'); hapticFeedback.notificationOccurred('error');
			}
		} catch (e: any) {
			setPaymentError(e?.response?.data?.error || e?.message || 'Verification failed'); hapticFeedback.notificationOccurred('error');
		} finally { setIsProcessingPayment(false); }
	};

	createEffect(() => {
		const initValuation = async () => {
			const u = username(); if (!u) return;
			setLoading(true); setError(null);
			const cachedAccess = localStorage.getItem(`val_access_${u}`);
			if (localStorage.getItem('val_free_used') === 'true') setFreeQuotaUsed(true);
			else cloudStorage.getItem('val_free_used').then((val) => { if (val === 'true') { setFreeQuotaUsed(true); localStorage.setItem('val_free_used', 'true'); } });

			if (cachedAccess) { setAccessGranted(true); setAccessMethod(cachedAccess as any); fetchValuation(u); }
			else {
				try {
					const res = await valuationApi.checkAccess(u);
					if (res?.free_quota_used) { setFreeQuotaUsed(true); localStorage.setItem('val_free_used', 'true'); cloudStorage.setItem('val_free_used', 'true'); }
					if (res?.has_access) { setAccessGranted(true); setAccessMethod(res.method || 'stars'); fetchValuation(u); }
					else { setShowPaymentGate(true); setLoading(false); }
				} catch (_) { setShowPaymentGate(true); setLoading(false); }
			}
		};
		initValuation();
	});

	return (
		<Show
			when={!loading()}
			fallback={
				<div class="flex flex-col justify-center items-center h-screen bg-[#030303] text-white/60 gap-4">
					<div class="w-12 h-12 rounded-full border-[3px] border-white/10 border-t-[#3390ec] animate-spin" />
					<span class="text-[13px] font-bold tracking-widest uppercase">{t('valuation.analyzing') || 'Analyzing market value...'}</span>
				</div>
			}
		>
			<Show
				when={!error()}
				fallback={
					<div class="min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center p-6 text-center">
						<div class="w-20 h-20 rounded-full bg-[#ff4a4a]/10 flex items-center justify-center mb-5 border border-[#ff4a4a]/20 shadow-inner">
							<span class="material-symbols-outlined text-[40px] text-[#ff4a4a]">error</span>
						</div>
						<h1 class="text-xl font-black mb-2">{t('valuation.error_title') || 'Analysis Failed'}</h1>
						<p class="text-[13px] text-white/50 leading-relaxed mb-6 max-w-xs">{error()}</p>
						<button onClick={() => window.history.back()} class="h-12 px-8 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-[16px] transition-all active:scale-95 shadow-sm">
							{t('valuation.back') || 'Go Back'}
						</button>
					</div>
				}
			>
				<div class="min-h-screen bg-[#030303] text-white px-4 py-6 flex flex-col items-center font-sans pb-28 select-none relative overflow-x-hidden overflow-y-auto max-w-full" style={{ 'touch-action': 'pan-y' }} dir={isRtl() ? 'rtl' : 'ltr'}>
					
					{/* Ambient Dynamic Background Glow */}
					<div class="absolute top-0 left-1/2 -translate-x-1/2 w-[150vw] h-[400px] blur-[100px] pointer-events-none z-0 opacity-40 transition-colors duration-1000" style={{ background: `radial-gradient(circle, ${getTierTheme(data()?.rarity?.tier || '').glow} 0%, transparent 60%)` }} />

					{/* ═══════ ACCESS AUDIT BADGE ═══════ */}
					<Show when={accessMethod()}>
						<div class="w-full max-w-[400px] mb-5 bg-[#12141C]/80 backdrop-blur-md border border-white/10 rounded-[20px] p-3 flex items-center justify-between shadow-lg relative z-10">
							<div class="flex items-center gap-3">
								<div class={`w-10 h-10 rounded-[14px] flex items-center justify-center text-lg shrink-0 border shadow-inner ${accessMethod() === 'stars' ? 'bg-amber-400/10 text-amber-400 border-amber-400/30' : accessMethod() === 'coins' ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30' : 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30'}`}>
									{accessMethod() === 'stars' ? '⭐' : accessMethod() === 'coins' ? '🪙' : '🎁'}
								</div>
								<div class="flex flex-col text-start">
									<span class="text-[9px] text-white/40 uppercase font-black tracking-widest">{t('valuation.payment_method_badge') || 'ACCESS GRANTED'}</span>
									<span class="text-[13px] font-bold text-white">{accessMethod() === 'stars' ? t('valuation.method_stars') : accessMethod() === 'coins' ? t('valuation.method_coins') : t('valuation.method_free')}</span>
								</div>
							</div>
							<span class="text-[10px] font-mono px-2.5 py-1 rounded-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black uppercase tracking-widest shadow-sm">VERIFIED</span>
						</div>
					</Show>

					{/* ═══════ HERO TILT CARD ═══════ */}
					<div class={`w-full max-w-[400px] aspect-square p-[2px] bg-gradient-to-br ${getTierTheme(data()?.rarity?.tier || '').wrapper} rounded-[44px] mb-6 relative z-10`} style={{ 'aspect-ratio': '1 / 1' }}>
						<div
							ref={cardRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
							class="w-full h-full bg-[#08090D] rounded-[42px] p-7 relative overflow-hidden flex flex-col justify-between shadow-inner"
							style={{ transform: `perspective(1000px) rotateX(${tilt().x}deg) rotateY(${tilt().y}deg)`, 'background-image': 'radial-gradient(rgba(255, 255, 255, 0.05) 1.5px, transparent 1.5px)', 'background-size': '20px 20px', transition: 'transform 0.1s ease-out' }}
						>
							<div class="absolute inset-0 pointer-events-none z-20 mix-blend-overlay transition-opacity duration-300 opacity-70" style={{ background: `radial-gradient(circle at ${tilt().glossX}% ${tilt().glossY}%, rgba(255,255,255,0.25) 0%, transparent 50%)` }} />
							<div class="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
							<div class="absolute inset-0 pointer-events-none opacity-30" style={{ background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.05) 55%, transparent 70%)' }} />

							<div class="flex justify-between items-center z-10">
								<span class={`px-3.5 py-1.5 border rounded-[10px] text-[10px] font-black tracking-widest uppercase shadow-sm ${getTierTheme(data()?.rarity?.tier || '').badge}`}>
									{data()?.rarity?.tier || 'Standard'}
								</span>
								<span class="text-[11px] font-mono font-black text-white/30 tracking-[4px] uppercase bg-white/5 px-3 py-1 rounded-[10px]">iFragment</span>
							</div>

							<div class="flex flex-col justify-center items-center z-10 text-center flex-grow relative py-6 w-full">
								<div class="absolute w-full h-[140px] opacity-60 -z-10 pointer-events-none" style={{ background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${getTierTheme(data()?.rarity?.tier || '').glow}, transparent 70%)` }} />
								<div class="flex items-center justify-center gap-2 w-full">
									<span class="text-white/20 font-black text-[24px] select-none">✦</span>
									<span class={`inline-block font-black tracking-tight bg-gradient-to-r ${getTierTheme(data()?.rarity?.tier || '').text} bg-clip-text text-transparent drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] truncate max-w-[80%]`} style={{ 'font-size': getFontSize(data()?.username || username()) }} dir="ltr">
										@{data()?.username || username()}
									</span>
									<span class="text-white/20 font-black text-[24px] select-none">✦</span>
								</div>
							</div>

							<div class="flex justify-between items-end border-t border-white/10 pt-4 z-10">
								<div class="flex flex-col gap-1 text-left">
									<span class="text-[9px] font-black text-white/40 uppercase tracking-widest mb-0.5">Estimated Value</span>
									<div class="flex items-center gap-2">
										<svg class="w-7 h-7 filter drop-shadow-[0_0_12px_rgba(51,144,236,0.6)]" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" fill="#0098EA"/><path d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5765 22.4861C43.3045 19.4202 41.0761 15.6277 37.5765 15.6277H37.5603ZM26.2483 36.8068L23.6119 31.8097L17.2017 20.6506C16.6742 19.7557 17.3255 18.6198 18.4223 18.6198H26.2483V36.8068ZM38.7972 20.6506L32.387 31.8259L29.7506 36.8068V18.6361H37.5765C38.6734 18.6361 39.3247 19.772 38.7972 20.6669V20.6506Z" fill="white"/></svg>
										<span class="text-[30px] font-black text-white leading-none drop-shadow-md font-sans tracking-tight">{parseFloat(data()?.expected_ton || '0').toLocaleString('en-US')}</span>
										<span class="text-[14px] font-black text-[#3390ec] leading-none mb-0.5">TON</span>
									</div>
								</div>
								<div class="flex flex-col items-end gap-2">
									<div class="flex items-center gap-1.5 bg-[#00ff88]/10 px-3 py-1 rounded-[8px] border border-[#00ff88]/30 text-[#00ff88] font-black uppercase tracking-widest text-[9px] shadow-[0_0_15px_rgba(0,255,136,0.15)]">
										<div class="w-1.5 h-1.5 bg-[#00ff88] rounded-full animate-pulse shadow-[0_0_8px_#00ff88]" /> Valued
									</div>
									<span class="text-[14px] text-white/50 font-black leading-none tracking-tight">≈ ${parseFloat(data()?.expected_usd || '0').toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
								</div>
							</div>
						</div>
					</div>

					{/* ═══════ ACTION BUTTONS ═══════ */}
					<div class="flex gap-3 w-full max-w-[400px] relative z-10 mb-8">
						<button onClick={handleSendToChat} disabled={downloading() || sent()} class={`flex-1 h-14 rounded-[16px] font-black text-[13px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-md border ${sent() ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-[#12141C]/80 backdrop-blur-md hover:bg-white/10 active:scale-95 border-white/10 text-white'}`}>
							<Show when={!downloading()} fallback={<><div class="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /><span>{t('valuation.sending') || 'SENDING...'}</span></>}>
								<Show when={!sent()} fallback={<><span class="material-symbols-outlined text-[20px]">check_circle</span><span>{t('valuation.sent_to_chat') || 'SENT!'}</span></>}>
									<span class="material-symbols-outlined text-[20px]">send</span> {t('valuation.download') || 'SEND TO CHAT'}
								</Show>
							</Show>
						</button>
						<button onClick={handleShareToStory} disabled={sharing()} class="flex-1 h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] active:scale-95 text-white font-black text-[13px] uppercase tracking-wider rounded-[16px] flex items-center justify-center gap-2 transition-all shadow-[0_8px_20px_rgba(51,144,236,0.3)] disabled:opacity-60 border border-white/10">
							<Show when={!sharing()} fallback={<><div class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /><span>{t('valuation.sharing') || 'UPLOADING...'}</span></>}>
								<span class="material-symbols-outlined text-[20px]">amp_stories</span> {t('valuation.share') || 'STORY'}
							</Show>
						</button>
					</div>

					<div class="w-full max-w-[400px] flex flex-col gap-4 relative z-10">
						
						{/* ═══════ PRICE RANGE HUD ═══════ */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-4 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
							<div class="flex items-center justify-between text-white/90">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-[20px] text-[#3390ec]">monitoring</span>
									<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.price_range') || 'PRICE RANGE'}</span>
								</div>
								<span class="text-[10px] font-bold text-white/40 uppercase bg-white/5 px-2 py-1 rounded-[6px]">{t('valuation.market_estimation') || 'ESTIMATION'}</span>
							</div>
							<div class="relative w-full h-3 bg-[#08090D] rounded-full overflow-hidden flex shadow-inner border border-white/5 mt-1">
								<div class="h-full bg-gradient-to-r from-[#3390ec]/20 to-[#3390ec] rounded-l-full" style={{ width: '30%' }} />
								<div class="h-full bg-[#3390ec] relative shadow-[0_0_10px_#3390ec]" style={{ width: '40%' }} />
								<div class="h-full bg-gradient-to-r from-[#3390ec] to-emerald-400/20 rounded-r-full" style={{ width: '30%' }} />
								<div class="absolute top-0 bottom-0 w-1 bg-white left-[50%] -translate-x-1/2 shadow-[0_0_12px_white]" />
							</div>
							<div class="flex justify-between items-end w-full">
								<div class="flex flex-col text-left opacity-60">
									<span class="text-white/50 text-[10px] uppercase font-black tracking-widest mb-0.5">{t('valuation.floor') || 'LOW'}</span>
									<span class="text-white font-mono font-bold text-[12px]">{parseFloat(data()?.low_ton || '0').toLocaleString('en-US')}</span>
								</div>
								<div class="flex flex-col text-center bg-[#08090D] border border-white/10 rounded-[14px] px-5 py-2 shadow-sm">
									<span class="text-[#3390ec] text-[10px] uppercase font-black tracking-widest mb-0.5">{t('valuation.expected_label') || 'EXPECTED'}</span>
									<span class="text-white font-mono font-black text-[16px]">{parseFloat(data()?.expected_ton || '0').toLocaleString('en-US')} TON</span>
								</div>
								<div class="flex flex-col text-right opacity-60">
									<span class="text-white/50 text-[10px] uppercase font-black tracking-widest mb-0.5">{t('valuation.ceiling') || 'HIGH'}</span>
									<span class="text-white font-mono font-bold text-[12px]">{parseFloat(data()?.high_ton || '0').toLocaleString('en-US')}</span>
								</div>
							</div>
						</div>

						{/* ═══════ AI FACTORS & REASONING ═══════ */}
						<Show when={data()?.tags && data()!.tags.length > 0}>
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-3.5 shadow-sm">
								<div class="flex items-center gap-2 text-white/90">
									<span class="material-symbols-outlined text-[20px] text-amber-400">auto_awesome</span>
									<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.ai_factors') || 'VALUATION FACTORS'}</span>
								</div>
								<div class="flex flex-wrap gap-2 pt-1">
									{data()?.tags?.map((tag) => <span class="bg-[#08090D] border border-white/10 text-white/70 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-[10px] shadow-inner">{tag}</span>)}
								</div>
							</div>
						</Show>

						<Show when={data()?.reasoning_log?.AI_Reasoning}>
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-3 shadow-sm">
								<div class="flex items-center gap-2 text-white/90 mb-1">
									<span class="material-symbols-outlined text-[20px] text-emerald-400">psychology_alt</span>
									<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.ai_reasoning') || 'AI REASONING'}</span>
								</div>
								<div class="text-white/60 text-[12px] leading-relaxed font-medium whitespace-pre-line border-l-[3px] border-emerald-500/40 pl-3.5 ml-1">
									"{data()?.reasoning_log?.AI_Reasoning}"
								</div>
							</div>
						</Show>

						<div class="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent my-2" />

						{/* ═══════ HISTORY & COMPARABLES (RESTORED) ═══════ */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-4 shadow-sm">
							<div class="flex items-center gap-2 text-white/90">
								<span class="material-symbols-outlined text-[20px] text-[#3390ec]">history</span>
								<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.history_title') || 'OWNERSHIP HISTORY'}</span>
							</div>
							<Show when={data()?.history?.is_sold || (data()?.history?.transactions?.length ?? 0) > 0} fallback={
								<div class="flex items-center gap-3 bg-emerald-400/10 border border-emerald-400/20 rounded-[16px] p-4 shadow-inner">
									<span class="material-symbols-outlined text-emerald-400">verified</span>
									<span class="text-emerald-400 text-[12px] font-bold tracking-wide">{t('valuation.not_sold') || 'Never sold on Fragment!'}</span>
								</div>
							}>
								<div class="flex flex-col rounded-[16px] overflow-hidden bg-[#08090D] border border-white/5">
									<div class="grid grid-cols-3 p-3 bg-white/[0.03] text-[10px] font-black text-white/40 uppercase tracking-widest border-b border-white/5">
										<span>{t('valuation.sale_price') || 'PRICE'}</span><span class="text-center">{t('valuation.date') || 'DATE'}</span><span class="text-right">{t('valuation.buyer') || 'BUYER'}</span>
									</div>
									<Show when={(data()?.history?.transactions?.length ?? 0) > 0} fallback={<div class="p-5 text-center text-white/40 text-[12px] font-medium">{t('valuation.no_tx') || 'No transaction details.'}</div>}>
										{data()?.history?.transactions?.map((tx, idx) => (
											<div class={`grid grid-cols-3 p-3.5 items-center text-[12px] hover:bg-white/[0.02] transition-colors ${idx !== (data()?.history?.transactions?.length || 0) - 1 ? 'border-b border-white/5' : ''}`}>
												<span class="text-white font-mono font-bold">{tx.sale_price_ton} TON</span>
												<span class="text-white/40 text-[11px] font-mono text-center">{new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
												<span class="text-[#3390ec] font-mono font-bold text-[11px] truncate text-right">{tx.buyer ? `${tx.buyer.slice(0, 5)}...${tx.buyer.slice(-4)}` : 'Fragment'}</span>
											</div>
										))}
									</Show>
								</div>
							</Show>
						</div>

						<Show when={(data()?.comparables?.length ?? 0) > 0}>
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-4 shadow-sm">
								<div class="flex items-center justify-between text-white/90">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-[20px] text-emerald-400">payments</span>
										<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.comp_title') || 'COMPARABLES'}</span>
									</div>
									<span class="text-[10px] font-bold text-white/40 bg-white/5 px-2 py-1 rounded-[6px]">{data()?.comparables?.length} SALES</span>
								</div>
								<div class="flex flex-col rounded-[16px] overflow-hidden bg-[#08090D] border border-white/5">
									<div class="grid grid-cols-3 p-3 bg-white/[0.03] text-[10px] font-black text-white/40 uppercase tracking-widest border-b border-white/5">
										<span>USERNAME</span><span class="text-center">{t('valuation.sale_price') || 'PRICE'}</span><span class="text-right">{t('valuation.date') || 'DATE'}</span>
									</div>
									{data()?.comparables?.map((comp) => (
										<div onClick={() => window.location.href = `/username?u=${comp.username}`} class="grid grid-cols-3 p-3.5 items-center border-b border-white/5 text-[12px] hover:bg-white/[0.04] cursor-pointer transition-colors">
											<span class="text-[#3390ec] font-bold truncate">@{comp.username}</span>
											<span class="text-emerald-400 font-mono font-bold text-center">{comp.price?.toLocaleString()} TON</span>
											<span class="text-white/40 text-[11px] text-right font-mono">{comp.date ? new Date(comp.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-'}</span>
										</div>
									))}
								</div>
							</div>
						</Show>

						{/* ═══════ SIMILAR USERNAMES (ENHANCED WITH PRICING & NAV) ═══════ */}
						<Show when={(data()?.similar?.length ?? 0) > 0}>
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/10 rounded-[24px] p-5 flex flex-col gap-4 shadow-lg w-full overflow-hidden">
								<div class="flex items-center justify-between text-white/90">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-[20px] text-amber-400">grid_view</span>
										<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.similar_title') || 'SIMILAR USERNAMES & VALUATIONS'}</span>
									</div>
									<span class="text-[10px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-[8px]">
										{data()?.similar?.length} MARKET ITEMS
									</span>
								</div>
								
								{/* Horizontal Scroll Container */}
								<div class="flex gap-3 overflow-x-auto pb-3 snap-x hide-scrollbar w-full">
									{data()?.similar?.map((sim) => {
										const getStatusBadge = (status?: string) => {
											switch (status) {
												case 'sold': case 'taken': return { text: t('valuation.status_sold') || 'TAKEN', bg: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' };
												case 'on_sale': return { text: t('valuation.status_on_sale') || 'ON SALE', bg: 'bg-[#3390ec]/20 text-[#3390ec] border border-[#3390ec]/30' };
												case 'on_auction': return { text: t('valuation.status_on_auction') || 'AUCTION', bg: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' };
												case 'available': return { text: t('valuation.status_available') || 'AVAILABLE', bg: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' };
												default: return { text: t('valuation.status_non_nft') || 'NON-NFT', bg: 'bg-white/5 text-white/40 border border-white/10' };
											}
										};
										const badge = getStatusBadge(sim.status);

										return (
											<div onClick={() => window.location.href = `/username?u=${sim.username}`} class="min-w-[230px] max-w-[250px] flex-shrink-0 bg-[#08090D] border border-white/10 hover:border-[#3390ec]/50 rounded-[20px] p-4 snap-start cursor-pointer hover:bg-white/[0.04] transition-all flex flex-col justify-between gap-3 shadow-md relative overflow-hidden group">
												<div class="flex items-center justify-between gap-2">
													<div class="text-[#3390ec] font-black text-[15px] truncate">@{sim.username}</div>
													<span class={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-[8px] ${badge.bg}`}>{badge.text}</span>
												</div>

												<div class="text-white/60 text-[11px] line-clamp-2 leading-relaxed font-medium bg-white/[0.02] p-2 rounded-[10px] border border-white/5">
													{sim.reason || 'Similar structure & segment match'}
												</div>

												<div class="pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px]">
													<span class="text-white/40 font-bold uppercase tracking-wider text-[9px]">
														{sim.status === 'on_sale' ? (t('valuation.ask_price' as any) || 'ASK') : (t('valuation.est_market_val' as any) || 'VALUATION')}
													</span>
													<div class="flex flex-col items-end">
														<span class="text-emerald-400 font-mono font-black text-[13px]">
															{sim.sale_price && sim.sale_price > 0 ? `${sim.sale_price.toLocaleString()} TON` : '-'}
														</span>
														{sim.sale_price_usd && sim.sale_price_usd > 0 && (
															<span class="text-white/40 text-[9px] font-mono">≈ ${sim.sale_price_usd.toLocaleString()}</span>
														)}
													</div>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						</Show>

						{/* ═══════ PORTFOLIO SECTION ═══════ */}
						<Show when={data()?.portfolio && (data()?.portfolio?.items?.length ?? 0) > 0}>
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/10 rounded-[24px] p-5 flex flex-col gap-4 shadow-lg">
								<div class="flex items-center justify-between text-white/90">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-[20px] text-cyan-400">folder_special</span>
										<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.portfolio_title') || 'PORTFOLIO INTELLIGENCE'}</span>
									</div>
									<span class="text-[10px] font-bold text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2.5 py-1 rounded-[8px]">
										{data()?.portfolio?.total_count} HANDLES
									</span>
								</div>

								<div class="text-[10px] font-bold text-white/50 bg-white/5 px-3.5 py-2.5 rounded-[12px] border border-white/5 truncate flex items-center gap-2" dir="ltr">
									<span class="material-symbols-outlined text-[16px] text-cyan-400">account_balance_wallet</span>
									{data()?.portfolio?.owner_address}
								</div>

								<div class="flex flex-col rounded-[16px] overflow-hidden bg-[#08090D] border border-white/10">
									<div class="grid grid-cols-2 p-3 bg-white/[0.03] text-[10px] font-black text-white/40 uppercase tracking-widest border-b border-white/5">
										<span>USERNAME</span><span class="text-right">{t('valuation.est_status') || 'VALUATION / STATUS'}</span>
									</div>
									<div class="flex flex-col max-h-[220px] overflow-y-auto hide-scrollbar">
										{data()?.portfolio?.items?.slice(0, 10).map((item) => (
											<div onClick={() => window.location.href = `/username?u=${item.username}`} class="grid grid-cols-2 p-3.5 items-center border-b border-white/5 text-[12px] hover:bg-white/[0.04] cursor-pointer transition-colors">
												<span class="text-[#3390ec] font-bold truncate">@{item.username}</span>
												<span class="text-right text-[11px] text-emerald-400 font-mono font-bold">
													{item.sold_price ? `${item.sold_price.toLocaleString()} TON` : item.status}
												</span>
											</div>
										))}
									</div>
								</div>

								<Show when={data()?.portfolio?.total_value_ton}>
									<div class="p-3.5 bg-cyan-400/10 border border-cyan-400/20 rounded-[16px] flex items-center justify-between text-[12px] shadow-inner mt-1">
										<span class="text-cyan-400 font-bold uppercase tracking-wider">{t('valuation.est_portfolio_val') || 'PORTFOLIO VALUE BASIS'}</span>
										<span class="text-cyan-400 font-mono font-black text-[15px]">{data()?.portfolio?.total_value_ton?.toLocaleString()} TON</span>
									</div>
								</Show>
							</div>
						</Show>

						{/* ═══════ DYNAMIC LIQUIDITY & VELOCITY MATRIX ═══════ */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/10 rounded-[24px] p-5 flex flex-col gap-4 shadow-lg relative overflow-hidden">
							<div class="flex items-center justify-between border-b border-white/10 pb-3">
								<div class="flex items-center gap-2 text-white/90">
									<span class="material-symbols-outlined text-[20px] text-amber-400">payments</span>
									<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.liquidity_risk_title') || 'LIQUIDITY & VELOCITY MATRIX'}</span>
								</div>
								<span class="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-[8px] bg-amber-400/10 text-amber-400 border border-amber-400/30">
									{data()?.liquidity_rating || 'HIGH VELOCITY'}
								</span>
							</div>
							
							<div class="grid grid-cols-2 gap-3">
								<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3.5 flex flex-col gap-1 shadow-inner">
									<span class="text-white/40 text-[10px] font-black uppercase tracking-widest">{t('valuation.liquidity_score') || 'LIQUIDITY RATING'}</span>
									<span class="text-emerald-400 font-black text-[14px] tracking-tight">
										{data()?.liquidity_rating || 'High'}
									</span>
								</div>
								<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3.5 flex flex-col gap-1 shadow-inner">
									<span class="text-white/40 text-[10px] font-black uppercase tracking-widest">{t('valuation.est_time_to_sell') || 'ESTIMATED SELL TIME'}</span>
									<span class="text-[#3390ec] font-mono font-black text-[13px]">
										{data()?.estimated_sell_time || '3–7 Days'}
									</span>
								</div>
							</div>

							<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3.5 flex items-center justify-between shadow-inner">
								<div class="flex flex-col gap-0.5">
									<span class="text-white/40 text-[10px] font-black uppercase tracking-widest">{t('valuation.target_buyer' as any) || 'TARGET BUYER PROFILE'}</span>
									<span class="text-white font-black text-[13px]">
										{data()?.target_buyer_profile || 'Personal Brand & Creator'}
									</span>
								</div>
								<span class="material-symbols-outlined text-[22px] text-cyan-400">group_work</span>
							</div>
						</div>

						{/* ═══════ 12-MONTH PROJECTED GROWTH & ROI ═══════ */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/10 rounded-[24px] p-5 flex flex-col gap-4 shadow-lg relative overflow-hidden">
							<div class="flex items-center justify-between border-b border-white/10 pb-3">
								<div class="flex items-center gap-2 text-white/90">
									<span class="material-symbols-outlined text-[20px] text-emerald-400">trending_up</span>
									<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.roi_title') || '12-MONTH MARKET PROJECTION'}</span>
								</div>
								<span class="text-[10px] font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-[8px]">
									3-SCENARIO MODEL
								</span>
							</div>

							<div class="grid grid-cols-3 gap-2.5">
								{/* Bull Case */}
								<div class="bg-[#08090D] border border-emerald-500/20 rounded-[16px] p-3 flex flex-col items-center text-center gap-1">
									<span class="text-emerald-400 text-[9px] font-black uppercase tracking-widest">BULL (+45%)</span>
									<span class="text-white font-mono font-black text-[13px]">
										{data()?.projected_growth?.bull_ton ? `${data()?.projected_growth?.bull_ton.toLocaleString()} TON` : `${Math.round(parseFloat(data()?.expected_ton || '0') * 1.45).toLocaleString()} TON`}
									</span>
									<span class="text-white/40 text-[9px] font-mono">
										≈ ${data()?.projected_growth?.bull_usd ? data()?.projected_growth?.bull_usd.toLocaleString() : Math.round(parseFloat(data()?.expected_usd || '0') * 1.45).toLocaleString()}
									</span>
								</div>

								{/* Base Case */}
								<div class="bg-[#08090D] border border-[#3390ec]/20 rounded-[16px] p-3 flex flex-col items-center text-center gap-1">
									<span class="text-[#3390ec] text-[9px] font-black uppercase tracking-widest">BASE (+22%)</span>
									<span class="text-white font-mono font-black text-[13px]">
										{data()?.projected_growth?.base_ton ? `${data()?.projected_growth?.base_ton.toLocaleString()} TON` : `${Math.round(parseFloat(data()?.expected_ton || '0') * 1.22).toLocaleString()} TON`}
									</span>
									<span class="text-white/40 text-[9px] font-mono">
										≈ ${data()?.projected_growth?.base_usd ? data()?.projected_growth?.base_usd.toLocaleString() : Math.round(parseFloat(data()?.expected_usd || '0') * 1.22).toLocaleString()}
									</span>
								</div>

								{/* Bear Case */}
								<div class="bg-[#08090D] border border-amber-500/20 rounded-[16px] p-3 flex flex-col items-center text-center gap-1">
									<span class="text-amber-400 text-[9px] font-black uppercase tracking-widest">BEAR (-5%)</span>
									<span class="text-white font-mono font-black text-[13px]">
										{data()?.projected_growth?.bear_ton ? `${data()?.projected_growth?.bear_ton.toLocaleString()} TON` : `${Math.round(parseFloat(data()?.expected_ton || '0') * 0.95).toLocaleString()} TON`}
									</span>
									<span class="text-white/40 text-[9px] font-mono">
										≈ ${data()?.projected_growth?.bear_usd ? data()?.projected_growth?.bear_usd.toLocaleString() : Math.round(parseFloat(data()?.expected_usd || '0') * 0.95).toLocaleString()}
									</span>
								</div>
							</div>
						</div>

						{/* ═══════ USERNAME DNA & LINGUISTICS ═══════ */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-3 shadow-sm">
							<div class="flex items-center gap-2 text-white/90 mb-2">
								<span class="material-symbols-outlined text-[20px] text-pink-400">biotech</span>
								<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.struct_title') || 'USERNAME DNA'}</span>
							</div>

							{[
								{ title: t('valuation.has_digits_title') || 'Pure Letters', desc: data()?.structure?.has_digits ? t('valuation.has_digits_desc') || 'Alpha-numeric' : t('valuation.no_digits_desc') || 'No numbers', premium: !data()?.structure?.has_digits },
								{ title: t('valuation.has_underscore_title') || 'Clean Handle', desc: data()?.structure?.has_underscore ? t('valuation.has_underscore_desc') || 'Has underscore' : t('valuation.no_underscore_desc') || 'Clean format', premium: !data()?.structure?.has_underscore },
								{ title: t('valuation.letters_only_title') || 'Alpha-Only', desc: data()?.structure?.letters_only ? t('valuation.letters_only_desc') || 'Pure alphabetic' : t('valuation.mixed_chars_desc') || 'Mixed characters', premium: data()?.structure?.letters_only }
							].map(item => (
								<div class="flex items-center justify-between bg-[#08090D] rounded-[16px] p-3.5 border border-white/5">
									<div class="flex flex-col gap-1">
										<span class="text-white/90 text-[12px] font-bold">{item.title}</span>
										<span class="text-white/40 text-[10px] font-medium">{item.desc}</span>
									</div>
									<span class={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-[8px] border ${item.premium ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30' : 'bg-red-400/10 text-red-400 border-red-400/30'}`}>
										{item.premium ? t('valuation.badge_premium') || 'PREMIUM' : t('valuation.badge_avoid') || 'AVOID'}
									</span>
								</div>
							))}

							{/* Linguistics */}
							<div class="flex items-center justify-between bg-[#08090D] rounded-[16px] p-3.5 border border-white/5 mt-1">
								<div class="flex flex-col gap-1">
									<span class="text-white/90 text-[12px] font-bold">{t('valuation.dict_word_title') || 'Dictionary Word'}</span>
									<span class="text-white/40 text-[10px] font-medium">{data()?.dictionary?.is_word ? data()?.dictionary?.part_of_speech || 'Recognized word' : 'Not found in dictionary'}</span>
								</div>
								<span class={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-[8px] border ${data()?.dictionary?.is_word ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30' : 'bg-white/5 text-white/40 border-white/10'}`}>
									{data()?.dictionary?.is_word ? 'YES' : 'NO'}
								</span>
							</div>
							<Show when={data()?.dictionary?.is_word && data()?.dictionary?.definition}>
								<div class="bg-[#08090D] rounded-[16px] p-3.5 border border-white/5 text-white/60 text-[11px] leading-relaxed font-medium italic border-l-[3px] border-l-cyan-400/50">
									"{data()?.dictionary?.definition}"
								</div>
							</Show>
						</div>

						{/* ═══════ METRICS (Brandability & Grade) ═══════ */}
						<div class="grid grid-cols-2 gap-3">
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-2 justify-center items-center text-center shadow-sm">
								<span class="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">{t('valuation.brandability') || 'BRANDABILITY'}</span>
								<div class="relative w-14 h-14 flex items-center justify-center">
									<svg class="w-full h-full transform -rotate-90 drop-shadow-[0_0_8px_rgba(244,114,182,0.4)]" viewBox="0 0 36 36">
										<path class="text-white/5" stroke-width="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
										<path class="text-pink-400" stroke-dasharray={`${data()?.brandability || 0}, 100`} stroke-width="3" stroke-linecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
									</svg>
									<span class="absolute text-white font-black text-[14px]">{data()?.brandability || 0}</span>
								</div>
							</div>
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-2 justify-center items-center text-center shadow-sm">
								<span class="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">{t('valuation.investment_grade') || 'INV. GRADE'}</span>
								<span class="text-[32px] font-black text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]">{data()?.investment_grade || 'C'}</span>
							</div>
						</div>

						{/* ═══════ CONFIDENCE & MODEL ENGINE (RESTORED) ═══════ */}
						<div class="grid grid-cols-2 gap-3 mt-1">
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col justify-center gap-2 shadow-sm">
								<span class="text-white/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-1">
									<span class="material-symbols-outlined text-[16px]">radar</span>
									{t('valuation.confidence') || 'CONFIDENCE'}
								</span>
								<span class={`text-[24px] font-black leading-none drop-shadow-md ${data()?.confidence_score && data()!.confidence_score >= 80 ? 'text-emerald-400' : data()?.confidence_score && data()!.confidence_score >= 50 ? 'text-amber-400' : 'text-[#ff4a4a]'}`}>
									{data()?.confidence_score || 0}%
								</span>
								<div class="w-full h-[4px] bg-white/5 rounded-full mt-1.5 overflow-hidden shadow-inner">
									<div class={`h-full rounded-full transition-all duration-1000 ${data()?.confidence_score && data()!.confidence_score >= 80 ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : data()?.confidence_score && data()!.confidence_score >= 50 ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'bg-[#ff4a4a]'}`} style={{ width: `${data()?.confidence_score || 0}%` }} />
								</div>
							</div>

							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col justify-center gap-1 shadow-sm">
								<span class="text-white/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-1">
									<span class="material-symbols-outlined text-[16px]">memory</span>
									{t('valuation.engine') || 'ENGINE'}
								</span>
								<span class="text-white font-black text-[15px] mt-1">{data()?.model_version || 'AVM-v2'}</span>
								<span class="text-white/40 text-[10px] font-bold mt-1 uppercase tracking-wider">
									{t('valuation.datapoints') || 'DATA POINTS'}: <span class="text-white/80">{data()?.comparable_sales_count || 0}</span>
								</span>
							</div>
						</div>
					</div>

				</div>
			</Show>

			{/* ═══════ HIDDEN CARD FOR EXPORT ═══════ */}
			<div style={{ position: 'fixed', left: '0px', top: '0px', width: '400px', height: '400px', 'z-index': '-9999', 'pointer-events': 'none' }}>
				<div ref={hiddenCardRef} class="w-[400px] h-[400px] bg-[#08090D] border border-white/10 rounded-[44px] p-8 relative overflow-hidden flex flex-col justify-between" style={{ 'background-image': 'radial-gradient(rgba(255, 255, 255, 0.05) 1.5px, transparent 1.5px)', 'background-size': '20px 20px' }}>
					<div class="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
					<div class="absolute inset-0 pointer-events-none opacity-30" style={{ background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.05) 55%, transparent 70%)' }} />
					
					<div class="flex justify-between items-center z-10">
						<span class={`px-4 py-1.5 border rounded-[10px] text-[10px] font-black tracking-widest uppercase ${getTierTheme(data()?.rarity?.tier || '').badge}`}>{data()?.rarity?.tier || 'Standard'}</span>
						<span class="text-[11px] font-mono font-black text-white/30 tracking-[4px] uppercase bg-white/5 px-3 py-1 rounded-[10px]">iFragment</span>
					</div>

					<div class="flex flex-col justify-center items-center z-10 text-center flex-grow relative py-6 w-full">
						<div class="absolute w-full h-[140px] opacity-70 -z-10 pointer-events-none" style={{ background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${getTierTheme(data()?.rarity?.tier || '').glow}, transparent 70%)` }} />
						<div class="flex items-center justify-center gap-2 w-full">
							<span class="text-white/20 font-black text-[24px] select-none">✦</span>
							<span class={`inline-block font-black tracking-tight bg-gradient-to-r ${getTierTheme(data()?.rarity?.tier || '').text} bg-clip-text text-transparent truncate max-w-[80%]`} style={{ 'font-size': getFontSize(data()?.username || username()) }} dir="ltr">@{data()?.username || username()}</span>
							<span class="text-white/20 font-black text-[24px] select-none">✦</span>
						</div>
					</div>

					<div class="flex justify-between items-end border-t border-white/10 pt-4 z-10">
						<div class="flex flex-col gap-1 text-left">
							<span class="text-[9px] font-black text-white/40 uppercase tracking-widest mb-0.5">Estimated Value</span>
							<div class="flex items-center gap-2">
								<svg class="w-7 h-7" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" fill="#0098EA"/><path d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5765 22.4861C43.3045 19.4202 41.0761 15.6277 37.5765 15.6277H37.5603ZM26.2483 36.8068L23.6119 31.8097L17.2017 20.6506C16.6742 19.7557 17.3255 18.6198 18.4223 18.6198H26.2483V36.8068ZM38.7972 20.6506L32.387 31.8259L29.7506 36.8068V18.6361H37.5765C38.6734 18.6361 39.3247 19.772 38.7972 20.6669V20.6506Z" fill="white"/></svg>
								<span class="text-[30px] font-black text-white leading-none font-sans tracking-tight">{parseFloat(data()?.expected_ton || '0').toLocaleString('en-US')}</span>
								<span class="text-[14px] font-black text-[#3390ec] leading-none mb-0.5">TON</span>
							</div>
						</div>
						<div class="flex flex-col items-end gap-2">
							<div class="flex items-center gap-1.5 bg-[#00ff88]/10 px-3 py-1 rounded-[8px] border border-[#00ff88]/30 text-[#00ff88] font-black uppercase tracking-widest text-[9px]">
								<div class="w-1.5 h-1.5 bg-[#00ff88] rounded-full" /> Valued
							</div>
							<span class="text-[14px] text-white/50 font-black leading-none tracking-tight">≈ ${parseFloat(data()?.expected_usd || '0').toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
						</div>
					</div>
				</div>
			</div>

			{/* ═══════ PREMIUM PAYMENT GATE (Bottom Sheet) ═══════ */}
			<Show when={showPaymentGate()}>
				<Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} class={`fixed inset-0 bg-[#030303]/90 backdrop-blur-2xl z-[100] flex items-end justify-center ${isRtl() ? 'rtl' : 'ltr'}`}>
					<Motion.div initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 0.35, easing: [0.32, 0.72, 0, 1] }} class="w-full max-h-[92vh] bg-[#12141C] rounded-t-[32px] border-t border-white/10 p-6 overflow-y-auto no-scrollbar shadow-[0_-30px_80px_rgba(0,0,0,0.8)] relative">
						
						<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />

						<div class="flex flex-col items-center text-center gap-2 mb-8">
							<div class="w-16 h-16 rounded-[20px] bg-gradient-to-br from-amber-400/20 to-cyan-400/10 border border-white/10 flex items-center justify-center shadow-[inset_0_2px_10px_rgba(255,255,255,0.05),0_10px_30px_rgba(245,158,11,0.15)] mb-2">
								<span class="material-symbols-outlined text-[36px] text-amber-400 drop-shadow-md">auto_awesome</span>
							</div>
							<h3 class="text-[22px] font-black text-white tracking-tight leading-tight max-w-sm">
								{t('valuation.gate_title') || 'Unlock Full AI Valuation'}
							</h3>
							<p class="text-[13px] font-medium text-white/50 max-w-xs leading-relaxed">
								{t('valuation.gate_subtitle') || 'Get deep market analytics, DNA structure, and exact pricing.'}
							</p>
						</div>

						<Show when={paymentError()}>
							<div class="bg-[#ff4a4a]/10 border border-[#ff4a4a]/30 text-[#ff4a4a] rounded-[16px] p-4 mb-5 text-[12px] font-bold flex items-center gap-2.5 shadow-sm">
								<span class="material-symbols-outlined text-[22px]">error</span>
								<span>{paymentError()}</span>
							</div>
						</Show>

						<div class="space-y-3">
							{/* Stars Option */}
							<button onClick={handlePayStars} disabled={isProcessingPayment()} class="w-full relative group overflow-hidden bg-[#08090D] border border-amber-400/20 hover:border-amber-400/50 rounded-[24px] p-4.5 text-left transition-all active:scale-[0.98] disabled:opacity-50 shadow-md">
								<div class="absolute -right-6 -top-6 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl group-hover:bg-amber-400/20 transition-all pointer-events-none" />
								<div class="relative flex items-center justify-between gap-3 z-10 w-full">
									<div class="flex items-center gap-4 flex-1 min-w-0">
										<div class="w-12 h-12 rounded-[16px] bg-amber-400/10 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner">
											<span class="material-symbols-outlined text-amber-400 text-[26px]">star</span>
										</div>
										<div class="flex flex-col text-start min-w-0">
											<h4 class="text-[15px] font-black text-white truncate">{t('valuation.pay_stars_title') || 'Pay with Stars'}</h4>
											<span class="text-[11px] font-medium text-white/50 mt-0.5 truncate">{t('valuation.pay_stars_desc') || 'Instant Telegram Payment'}</span>
										</div>
									</div>
									<div class="px-3.5 py-1.5 rounded-[10px] bg-amber-400/10 border border-amber-400/30 text-amber-400 font-black text-[13px] shrink-0 flex items-center gap-1.5 shadow-sm">
										<span class="material-symbols-outlined text-[16px]">star</span> 49
									</div>
								</div>
							</button>

							{/* Coins Option */}
							<button onClick={handlePayCoins} disabled={isProcessingPayment()} class="w-full relative group overflow-hidden bg-[#08090D] border border-cyan-400/20 hover:border-cyan-400/50 rounded-[24px] p-4.5 text-left transition-all active:scale-[0.98] disabled:opacity-50 shadow-md">
								<div class="absolute -right-6 -top-6 w-24 h-24 bg-cyan-400/10 rounded-full blur-2xl group-hover:bg-cyan-400/20 transition-all pointer-events-none" />
								<div class="relative flex items-center justify-between gap-3 z-10 w-full">
									<div class="flex items-center gap-4 flex-1 min-w-0">
										<div class="w-12 h-12 rounded-[16px] bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center shrink-0 shadow-inner">
											<span class="material-symbols-outlined text-cyan-400 text-[26px]">toll</span>
										</div>
										<div class="flex flex-col text-start min-w-0">
											<h4 class="text-[15px] font-black text-white truncate">{t('valuation.pay_coins_title') || 'Pay with Coins'}</h4>
											<span class="text-[11px] font-medium text-white/50 mt-0.5 truncate">{t('valuation.pay_coins_desc') || 'Use your mined balance'}</span>
										</div>
									</div>
									<div class="px-3.5 py-1.5 rounded-[10px] bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 font-black text-[13px] shrink-0 flex items-center gap-1.5 shadow-sm">
										<span class="material-symbols-outlined text-[16px]">toll</span> 88K
									</div>
								</div>
							</button>

							{/* Community Free Access */}
							<Show when={!freeQuotaUsed()}>
								<div class="w-full bg-[#08090D] border border-emerald-400/20 hover:border-emerald-400/50 rounded-[24px] p-4.5 flex flex-col gap-4 transition-all shadow-md mt-2">
									<div class="flex items-center gap-4">
										<div class="w-12 h-12 rounded-[16px] bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center shrink-0 shadow-inner">
											<span class="material-symbols-outlined text-emerald-400 text-[26px]">card_giftcard</span>
										</div>
										<div class="flex-1 flex flex-col text-start min-w-0">
											<h4 class="text-[15px] font-black text-white truncate">{t('valuation.free_channel_group_title') || 'Community Access'}</h4>
											<span class="text-[11px] font-medium text-white/50 mt-0.5 leading-relaxed">{t('valuation.free_channel_group_desc') || '1-Time Free pass for members'}</span>
										</div>
									</div>

									<div class="grid grid-cols-2 gap-2.5 w-full">
										<button onClick={() => openTelegramLink('https://t.me/FragmentsCommunity')} class="h-11 bg-white/5 hover:bg-white/10 border border-white/5 text-emerald-300 font-bold text-[12px] rounded-[14px] flex items-center justify-center gap-1.5 transition-all active:scale-95">
											<span class="material-symbols-outlined text-[18px]">podcasts</span> {t('valuation.join_channel_btn') || 'CHANNEL'}
										</button>
										<button onClick={() => openTelegramLink('https://t.me/FragmentInvestors')} class="h-11 bg-white/5 hover:bg-white/10 border border-white/5 text-emerald-300 font-bold text-[12px] rounded-[14px] flex items-center justify-center gap-1.5 transition-all active:scale-95">
											<span class="material-symbols-outlined text-[18px]">groups</span> {t('valuation.join_group_btn') || 'GROUP'}
										</button>
									</div>

									<button onClick={handleVerifyFreeAccess} disabled={isProcessingPayment()} class="w-full h-14 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-black font-black text-[13px] tracking-widest uppercase rounded-[16px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(52,211,153,0.3)] active:scale-95 transition-all disabled:opacity-50">
										<Show when={isProcessingPayment()} fallback={<><span class="material-symbols-outlined text-[20px]">verified</span>{t('valuation.verify_membership_btn') || 'VERIFY & ANALYZE'}</>}>
											<div class="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
										</Show>
									</button>
								</div>
							</Show>
						</div>

						<Show when={isProcessingPayment()}>
							<div class="absolute inset-0 bg-[#12141C]/90 backdrop-blur-md z-30 flex flex-col items-center justify-center rounded-t-[32px]">
								<span class="w-12 h-12 border-4 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin mb-4 shadow-[0_0_15px_#3390ec]" />
								<span class="text-[14px] font-black uppercase tracking-widest text-white animate-pulse">PROCESSING...</span>
							</div>
						</Show>
					</Motion.div>
				</Motion.div>
			</Show>
		</Show>
	);
};

export default UsernamePage;
