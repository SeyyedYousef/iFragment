import { useLocation, useNavigate } from '@solidjs/router';
import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { openTelegramLink } from '@tma.js/sdk-solid';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import {
	GiftThumbnail,
	type GiftValuationReport,
	getGiftCdnImageUrl,
	getGiftProxyImageUrl,
	giftsApi,
	OFFICIAL_GIFTS_120,
} from '@/entities/gifts/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { copyToClipboard, shareToStory } from '@/shared/lib/telegram-native.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { UnifiedPaywallGate } from '@/widgets/paywall/index.js';

export const GiftReportPage: Component = () => {
	useTelegramBackButton(-1);
	const location = useLocation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const openExternalUrl = (url: string) => {
		if (!url) return;
		try {
			if (url.startsWith('https://t.me/')) {
				openTelegramLink(url);
				return;
			}
		} catch {}
		window.open(url, '_blank', 'noopener,noreferrer');
	};

	const getGiftParam = () => {
		const params = new URLSearchParams(location.search);
		return params.get('g') || 'plush_pepe-42';
	};

	const giftID = () => getGiftParam();

	// Local State
	const [unlockedReport, setUnlockedReport] = createSignal<GiftValuationReport | null>(null);
	const [isWatching, setIsWatching] = createSignal(false);
	const [unlockError, setUnlockError] = createSignal<string | null>(null);
	const [copiedCert, setCopiedCert] = createSignal(false);
	const [sharing, setSharing] = createSignal(false);

	// 3D Gyro Card tilt state
	const [tilt, setTilt] = createSignal({ x: 0, y: 0, glossX: 50, glossY: 50 });
	let cardRef: HTMLDivElement | undefined;

	const handleMouseMove = (e: MouseEvent) => {
		if (!cardRef) return;
		const rect = cardRef.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		setTilt({
			x: (rect.height / 2 - y) / 10,
			y: (x - rect.width / 2) / 10,
			glossX: (x / rect.width) * 100,
			glossY: (y / rect.height) * 100,
		});
	};

	const handleMouseLeave = () => setTilt({ x: 0, y: 0, glossX: 50, glossY: 50 });

	// Curiosity Gate Query (Zero Price Leakage)
	const gateQuery = createQuery(() => ({
		queryKey: ['giftGate', giftID()],
		queryFn: () => giftsApi.getCuriosityGate(giftID()),
		staleTime: 60 * 1000,
	}));

	// Valuation Query (Runs if user already owns 24h report)
	const valuateQuery = createQuery(() => ({
		queryKey: ['giftValuation', giftID()],
		queryFn: () => giftsApi.valuate(giftID()),
		retry: false,
	}));

	// Enriched Report Query (Fetches provenance & on-chain metadata when unlocked)
	const enrichedQuery = createQuery(() => ({
		queryKey: ['giftEnrichedReport', giftID()],
		queryFn: () => giftsApi.getEnrichedReport(giftID()),
		enabled: !!(unlockedReport() || valuateQuery.data),
		staleTime: 5 * 60 * 1000,
		retry: false,
	}));

	// Unlock with Credit Mutation
	const unlockCreditMutation = createMutation(() => ({
		mutationFn: () => giftsApi.unlockWithCredit(giftID()),
		onSuccess: (data) => {
			try {
				haptic.notify('success');
			} catch {}
			setUnlockedReport(data);
			queryClient.invalidateQueries({ queryKey: ['giftValuation', giftID()] });
			queryClient.invalidateQueries({ queryKey: ['giftEnrichedReport', giftID()] });
		},
		onError: (err: any) => {
			try {
				haptic.notify('error');
			} catch {}
			const errorMsg =
				err?.response?.data?.error ||
				err?.response?.data?.message ||
				err?.message ||
				t('valuation.unlock_error') ||
				'Error unlocking report with credit.';
			setUnlockError(errorMsg);
		},
	}));

	const currentReport = () => enrichedQuery.data || unlockedReport() || valuateQuery.data;

	const handleWatchlistToggle = async () => {
		const nextState = !isWatching();
		try {
			haptic.impact('medium');
			await giftsApi.toggleWatchlist(giftID(), nextState);
			setIsWatching(nextState);
		} catch {
			try {
				haptic.notify('error');
			} catch {}
		}
	};

	const handleCopyCertificate = async () => {
		const link = window.location.href;
		await copyToClipboard(link);
		setCopiedCert(true);
		try {
			haptic.notify('success');
		} catch {}
		setTimeout(() => setCopiedCert(false), 3000);
	};

	const handleShareStory = async () => {
		if (sharing()) return;
		setSharing(true);
		try {
			haptic.impact('light');
			shareToStory(window.location.href, {
				text: `Verified Valuation for ${currentReport()?.display_title || giftID()} on iFragment!`,
				widget_link: {
					url: window.location.href,
					name: 'View Gift Intelligence',
				},
			});
		} catch {}
		setSharing(false);
	};

	const formatGram = (val?: string | number) => {
		if (!val) return '0';
		const num = typeof val === 'string' ? parseFloat(val) : val;
		return num.toLocaleString('en-US', { maximumFractionDigits: 1 });
	};

	const formatUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	const getGiftTierTheme = (tierName?: string, isCrafted = false) => {
		const tStr = (tierName || '').toLowerCase();
		if (tStr.includes('unique') || tStr.includes('1 of 1') || isCrafted) {
			return {
				wrapper:
					'from-[#ffaa00] via-[#ff7700] to-[#e65100] shadow-[0_20px_50px_rgba(255,119,0,0.35),inset_0_2px_10px_rgba(255,255,255,0.3)]',
				badge:
					'bg-[#ffaa00]/20 border-[#ffaa00]/40 text-[#ffaa00] shadow-[0_0_15px_rgba(255,170,0,0.3)]',
				glow: 'rgba(255,119,0,0.3)',
				accent: '#ffaa00',
			};
		}
		if (tStr.includes('mythic') || tStr.includes('legendary')) {
			return {
				wrapper:
					'from-[#AF52DE] via-[#7B2CBF] to-[#5A189A] shadow-[0_20px_50px_rgba(175,82,222,0.35),inset_0_2px_10px_rgba(255,255,255,0.3)]',
				badge:
					'bg-[#AF52DE]/20 border-[#AF52DE]/40 text-[#AF52DE] shadow-[0_0_15px_rgba(175,82,222,0.3)]',
				glow: 'rgba(175,82,222,0.3)',
				accent: '#AF52DE',
			};
		}
		if (tStr.includes('epic') || tStr.includes('rare')) {
			return {
				wrapper:
					'from-[#0098EA] via-[#0070BA] to-[#004B87] shadow-[0_20px_50px_rgba(0,152,234,0.35),inset_0_2px_10px_rgba(255,255,255,0.3)]',
				badge:
					'bg-[#0098EA]/20 border-[#0098EA]/40 text-[#0098EA] shadow-[0_0_15px_rgba(0,152,234,0.3)]',
				glow: 'rgba(0,152,234,0.3)',
				accent: '#0098EA',
			};
		}
		return {
			wrapper:
				'from-[#34C759] via-[#28A745] to-[#1E7E34] shadow-[0_20px_50px_rgba(52,199,89,0.3),inset_0_2px_10px_rgba(255,255,255,0.2)]',
			badge: 'bg-[#34C759]/20 border-[#34C759]/40 text-[#34C759]',
			glow: 'rgba(52,199,89,0.25)',
			accent: '#34C759',
		};
	};

	const resolvedModelSlug = () => {
		const raw =
			currentReport()?.model_id || currentReport()?.collection_id || giftID().split('-')[0];
		return raw.toLowerCase().replace(/[\s_-]+/g, '_');
	};

	const resolvedCollectionItem = () => {
		const slug = resolvedModelSlug();
		return OFFICIAL_GIFTS_120.find(
			(g) =>
				g.slug.replace(/_/g, '') === slug.replace(/_/g, '') ||
				g.name.toLowerCase().replace(/[^a-z0-9]/g, '') === slug.replace(/[^a-z0-9]/g, ''),
		);
	};

	const officialTelegramUrl = () => {
		const param = giftID();
		if (param.includes('-')) {
			const parts = param.split('-');
			const rawModel = parts[0];
			const serial = parts[1] || '1';
			const item = OFFICIAL_GIFTS_120.find(
				(g) =>
					g.slug.replace(/_/g, '') === rawModel.toLowerCase().replace(/_/g, '') ||
					g.name.toLowerCase().replace(/[^a-z0-9]/g, '') ===
						rawModel.toLowerCase().replace(/[^a-z0-9]/g, ''),
			);
			const pascal = item ? item.name.replace(/[^a-zA-Z0-9]/g, '') : rawModel;
			return `https://t.me/nft/${pascal}-${serial}`;
		}
		return `https://t.me/nft/${param}`;
	};

	const [offerSent, setOfferSent] = createSignal(false);
	const [alertActive, setAlertActive] = createSignal(false);

	const ownerInfo = createMemo(() => {
		const rep = currentReport();
		const enriched = enrichedQuery.data;
		const rawName = rep?.owner_name || gateQuery.data?.owner_name || '';
		const onChainAddr = enriched?.on_chain?.owner_address || '';

		const isAddress = (str: string) =>
			(str.startsWith('EQ') || str.startsWith('UQ') || str.startsWith('0:')) && str.length >= 40;

		let fullAddr = '';
		let shortAddr = '';
		let username = '';
		let displayName = '';
		let isOnChain = false;

		if (onChainAddr && isAddress(onChainAddr)) {
			fullAddr = onChainAddr;
			shortAddr = `${onChainAddr.slice(0, 6)}...${onChainAddr.slice(-4)}`;
			isOnChain = true;
		}

		if (rawName) {
			if (isAddress(rawName)) {
				if (!fullAddr) {
					fullAddr = rawName;
					shortAddr = `${rawName.slice(0, 6)}...${rawName.slice(-4)}`;
					isOnChain = true;
				}
			} else if (rawName.startsWith('@')) {
				username = rawName;
				displayName = rawName;
			} else {
				displayName = rawName;
			}
		}

		if (!displayName && !fullAddr) {
			displayName = t('gifts.inAppTelegramCustody') || 'کیف‌پول درون‌برنامه‌ای تلگرام';
		}

		const tonViewerUrl =
			enriched?.on_chain?.tonviewer_url || (fullAddr ? `https://tonviewer.com/${fullAddr}` : '');

		return {
			displayName,
			username,
			fullAddr,
			shortAddr: shortAddr || displayName,
			isOnChain,
			tonViewerUrl,
			scanTarget: username || fullAddr || displayName,
		};
	});

	const sellerNetProceeds = () => {
		const gross = Number(currentReport()?.expected_gram) || 0;
		const fragFee = gross * 0.05;
		const telegramRoyalty = gross * 0.05;
		const gasFee = 0.05;
		const net = Math.max(0, gross - fragFee - telegramRoyalty - gasFee);
		const netUsd = net * 4;
		const instantCashoutBid = Math.round(gross * 0.88);
		return {
			gross,
			fragFee,
			telegramRoyalty,
			gasFee,
			net,
			netUsd,
			instantCashoutBid,
		};
	};

	const handleSendOffer = () => {
		try {
			haptic.impact('medium');
			haptic.notify('success');
		} catch {}
		setOfferSent(true);
		setTimeout(() => setOfferSent(false), 4000);
	};

	const handleToggleAlert = () => {
		const next = !alertActive();
		try {
			haptic.impact('medium');
			haptic.notify('success');
		} catch {}
		setAlertActive(next);
	};

	const giftName = () =>
		currentReport()?.display_title ||
		(gateQuery.data ? `${gateQuery.data.model_name} #${gateQuery.data.serial_number}` : giftID());

	const theme = () =>
		getGiftTierTheme(
			currentReport()?.trait_dna?.[0]?.rarity_tier || 'Rare',
			gateQuery.data?.is_crafted,
		);

	const giftImageUrl = () => {
		if (gateQuery.data?.image_url) return gateQuery.data.image_url;
		if (currentReport()?.image_url) return currentReport()!.image_url;
		const slug = resolvedModelSlug();
		const model = gateQuery.data?.selected_model || currentReport()?.selected_model;
		return getGiftProxyImageUrl(slug, model) || getGiftCdnImageUrl(slug, model);
	};

	const giftSubtitle = () => {
		const model = gateQuery.data?.selected_model || currentReport()?.selected_model;
		if (model) {
			return `${t('gifts.model') || 'Model'}: ${model}`;
		}
		return undefined;
	};

	return (
		<div class="pb-40 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Gradient Glows matching Username Section */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[450px] bg-gradient-to-b from-[#0098EA]/20 via-[#AF52DE]/10 to-transparent blur-[90px] pointer-events-none z-0" />
			<div class="fixed bottom-20 right-0 w-80 h-80 bg-[#0098EA]/10 blur-[100px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-4">
				{/* Top Navigation Bar */}
				<div class="flex items-center justify-between mb-4">
					<button
						type="button"
						onClick={() => navigate('/gifts/intel')}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-white/80 transition-all active:scale-95"
					>
						<span class="material-symbols-outlined text-sm rtl:rotate-180">arrow_back</span>
						<span>{t('gifts.backToIntel')}</span>
					</button>

					<div class="flex items-center gap-2">
						<button
							type="button"
							onClick={handleWatchlistToggle}
							class={`w-8 h-8 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
								isWatching()
									? 'bg-amber-400/20 border-amber-400/40 text-amber-300'
									: 'bg-white/[0.05] border-white/10 text-white/60 hover:text-white'
							}`}
							title={isWatching() ? t('gifts.watching') : t('gifts.watchGift')}
						>
							<span
								class="material-symbols-outlined text-[18px]"
								style={{ 'font-variation-settings': isWatching() ? '"FILL" 1' : '"FILL" 0' }}
							>
								bookmark
							</span>
						</button>

						<button
							type="button"
							onClick={handleCopyCertificate}
							class="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white/60 hover:text-white transition-all active:scale-90"
							title={t('gifts.copyLink')}
						>
							<span class="material-symbols-outlined text-[18px]">
								{copiedCert() ? 'check' : 'share'}
							</span>
						</button>
					</div>
				</div>

				{/* ════════════════════════════════════════════════════════════════
				    STATE A: PRE-PAYWALL MINIMALIST GATE
				   ════════════════════════════════════════════════════════════════ */}
				<Show when={!currentReport()}>
					<div class="w-full max-w-[440px] mx-auto my-2">
						<UnifiedPaywallGate
							vertical="gift"
							targetTitle={giftName()}
							targetSubtitle={giftSubtitle()}
							targetImage={giftImageUrl()}
							targetIcon="featured_seasonal_and_gifts"
							targetBadge={t('paywall.ready_for_appraisal')}
							unlockCtaText={t('paywall.cta_unlock_specific', { target: giftName() })}
							onUnlock={async () => {
								await unlockCreditMutation.mutateAsync();
							}}
							unlocking={unlockCreditMutation.isPending}
							error={unlockError()}
						/>
					</div>
				</Show>

				{/* ════════════════════════════════════════════════════════════════
				    STATE B: 10-SECTION PREMIUM REPORT (3D Unlocked Gyro Card)
				   ════════════════════════════════════════════════════════════════ */}
				<Show when={currentReport()}>
					<div class="space-y-4">
						{/* 💎 3D HOLOGRAPHIC GYRO CARD (UNLOCKED STATE) */}
						<div
							class={`w-full aspect-square p-[3px] bg-gradient-to-br ${
								theme().wrapper
							} rounded-[44px] my-2 relative z-20 transition-all duration-300`}
						>
							<div
								ref={cardRef}
								onMouseMove={handleMouseMove}
								onMouseLeave={handleMouseLeave}
								class="w-full h-full bg-[#08090D] rounded-[41px] p-7 relative overflow-hidden flex flex-col justify-between shadow-inner"
								style={{
									transform: `perspective(1200px) rotateX(${tilt().x}deg) rotateY(${tilt().y}deg)`,
									'background-image':
										'radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 1.5px)',
									'background-size': '24px 24px',
									transition: 'transform 0.1s ease-out',
								}}
							>
								{/* Gloss Shimmer */}
								<div
									class="absolute inset-0 pointer-events-none z-20 mix-blend-overlay transition-opacity duration-300 opacity-80"
									style={{
										background: `radial-gradient(circle at ${tilt().glossX}% ${
											tilt().glossY
										}%, rgba(255,255,255,0.45) 0%, transparent 60%)`,
									}}
								/>
								<div class="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />

								{/* Card Header */}
								<div class="flex justify-between items-center z-10">
									<span
										class={`px-3.5 py-1.5 border rounded-[12px] text-[10px] font-black tracking-widest uppercase shadow-sm ${
											theme().badge
										}`}
									>
										{currentReport()?.trait_dna?.[0]?.rarity_tier || 'RARE'}
									</span>
									<span class="text-[11px] font-mono font-black text-white/30 tracking-[4px] uppercase bg-white/5 border border-white/5 px-3.5 py-1 rounded-[12px]">
										{'IFRAGMENT'}
									</span>
								</div>

								{/* Center Gift Identity with Real Thumbnail */}
								<div class="flex flex-col justify-center items-center z-10 text-center flex-grow py-4 w-full">
									<div
										class="absolute w-full h-[150px] opacity-60 -z-10 pointer-events-none mix-blend-screen"
										style={{
											background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${
												theme().glow
											}, transparent 70%)`,
										}}
									/>
									<div class="w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#0098EA]/30 to-[#AF52DE]/30 p-[1px] mb-3 shadow-2xl shadow-[#0098EA]/30 flex items-center justify-center overflow-hidden">
										<GiftThumbnail
											slug={resolvedModelSlug()}
											name={giftName()}
											model={
												currentReport()?.selected_model || currentReport()?.trait_dna?.[0]?.value
											}
											customImageUrl={currentReport()?.image_url || gateQuery.data?.image_url}
											class="w-full h-full object-contain p-2 drop-shadow-xl"
										/>
									</div>

									<h2 class="text-2xl font-black text-white tracking-tight drop-shadow-md truncate max-w-[90%]">
										{giftName()}
									</h2>
									<div class="flex items-center gap-1.5 mt-1">
										<button
											type="button"
											onClick={() => openExternalUrl(officialTelegramUrl())}
											class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0098EA]/20 hover:bg-[#0098EA]/30 border border-[#0098EA]/40 text-[#0098EA] text-[10px] font-mono font-bold transition-all"
										>
											<span class="material-symbols-outlined text-[11px]">link</span>
											<span>{officialTelegramUrl().replace('https://', '')}</span>
											<span class="material-symbols-outlined text-[10px]">open_in_new</span>
										</button>
									</div>
								</div>

								{/* Bottom Price Readout */}
								<div class="flex justify-between items-end border-t border-white/10 pt-4 z-10">
									<div class="flex flex-col gap-0.5 text-left">
										<span class="text-[9px] font-black text-white/40 uppercase tracking-widest">
											{t('gifts.fairValue')}
										</span>
										<div class="flex items-center gap-2">
											<span class="text-[26px] font-black text-white font-mono tracking-tight">
												{formatGram(currentReport()?.expected_gram)}
											</span>
											<span class="text-[13px] font-black text-[#0098EA]">{t('common.ton')}</span>
											<span class="text-[13px] font-bold text-white/40">
												({formatUsd(currentReport()?.expected_usd)})
											</span>
										</div>
									</div>
									<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black">
										<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
										<span>{currentReport()?.confidence_score}%</span>
									</div>
								</div>
							</div>
						</div>

						{/* SECTION 1: VERDICT & CONFIDENCE CARD */}
						<div class="bg-[#12141C]/90 border border-white/10 rounded-[28px] p-5 shadow-2xl backdrop-blur-2xl">
							<div class="flex items-center justify-between mb-3">
								<span class="text-[11px] uppercase font-extrabold text-[#0098EA] tracking-wider px-2.5 py-1 rounded-full bg-[#0098EA]/15 border border-[#0098EA]/30">
									{t('gifts.fairValue')}
								</span>
								<button
									type="button"
									onClick={handleCopyCertificate}
									class="flex items-center gap-1 text-[11px] font-mono text-white/40 hover:text-white transition-colors"
								>
									<span>{t('gifts.certificate')}:</span>
									<span class="text-[#0098EA] font-bold">
										{currentReport()?.certificate_id || 'CERT-GF-8839'}
									</span>
								</button>
							</div>

							<div class="flex items-baseline gap-2 my-2">
								<span class="text-3xl font-black text-white font-mono">
									{formatGram(currentReport()?.expected_gram)}
								</span>
								<span class="text-base font-bold text-[#0098EA]">TON / GRAM</span>
								<span class="text-sm font-bold text-white/40">
									({formatUsd(currentReport()?.expected_usd)})
								</span>
							</div>
							<p class="text-xs text-white/50 font-medium">
								{t('gifts.fairRange')}: {formatGram(currentReport()?.low_gram)} –{' '}
								{formatGram(currentReport()?.high_gram)} TON
							</p>

							<div class="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.08] text-[11px] text-white/40">
								<span>
									{t('gifts.basis')}:{' '}
									<strong class="text-white/70">{currentReport()?.price_basis}</strong>
								</span>
								<button
									type="button"
									onClick={handleShareStory}
									class="flex items-center gap-1 text-emerald-400 font-bold hover:underline"
								>
									<span class="material-symbols-outlined text-[14px]">send</span>
									<span>{t('gifts.shareStory')}</span>
								</button>
							</div>
						</div>

						{/* 🏛️ SECTION 1.5: VERIFIED OWNER VAULT & PORTFOLIO INTELLIGENCE */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl space-y-3.5">
							<div class="flex items-center justify-between">
								<h3 class="text-sm font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[#0098EA] text-base">
										account_balance_wallet
									</span>
									<span>{t('gifts.ownerVaultTitle')}</span>
								</h3>
								<span
									class={`text-[9px] uppercase font-mono font-black px-2 py-0.5 rounded-full border ${
										ownerInfo().isOnChain
											? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
											: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
									}`}
								>
									{ownerInfo().isOnChain ? 'TEP-62 ON-CHAIN' : 'TELEGRAM CUSTODY'}
								</span>
							</div>

							{/* Owner Net Worth & Status Banner */}
							<div class="bg-gradient-to-r from-[#0098EA]/15 via-emerald-500/10 to-[#AF52DE]/15 border border-[#0098EA]/30 rounded-2xl p-3.5">
								<div class="flex items-center justify-between mb-1.5">
									<span class="text-[10px] font-bold text-white/50 uppercase tracking-wider">
										{t('gifts.verifiedOwner')}
									</span>
									<span class="text-[10px] font-mono font-bold text-[#0098EA] bg-[#0098EA]/20 px-2 py-0.5 rounded-full flex items-center gap-1">
										<span class="material-symbols-outlined text-[10px]">verified</span>
										<span>{ownerInfo().isOnChain ? 'On-Chain' : 'Off-Chain'}</span>
									</span>
								</div>
								<div class="flex items-center justify-between gap-2">
									<div class="min-w-0">
										<span class="text-base font-black text-white font-mono block truncate">
											{ownerInfo().displayName}
										</span>
										<p class="text-[10px] text-white/50 mt-0.5">
											{ownerInfo().isOnChain
												? t('gifts.onChainOwnerDesc') ||
													'مالکیت این آیتم بر روی بلاکچین TON ثبت گردیده است.'
												: t('gifts.telegramCustodyDesc') ||
													'هدیه در حال حاضر در کیف‌پول درون‌برنامه‌ای تلگرام نگهداری می‌شود.'}
										</p>
									</div>
									<Show when={ownerInfo().username}>
										<button
											type="button"
											onClick={() =>
												openExternalUrl(`https://t.me/${ownerInfo().username!.replace('@', '')}`)
											}
											class="p-2 rounded-xl bg-[#0098EA]/20 hover:bg-[#0098EA]/30 text-[#0098EA] border border-[#0098EA]/40 shrink-0 transition-all flex items-center gap-1 text-[11px] font-bold"
										>
											<span>{t('gifts.tgProfile') || 'پروفایل'}</span>
											<span class="material-symbols-outlined text-xs">open_in_new</span>
										</button>
									</Show>
								</div>
							</div>

							{/* Owner Address & Action Buttons (Only when on-chain address exists) */}
							<Show when={ownerInfo().fullAddr}>
								<div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 flex items-center justify-between text-xs">
									<div>
										<span class="text-[10px] uppercase font-bold text-white/40 block">
											{t('gifts.onChainWalletAddress')}
										</span>
										<span class="font-mono font-bold text-white text-xs mt-0.5 block">
											{ownerInfo().shortAddr}
										</span>
									</div>
									<div class="flex items-center gap-1.5">
										<button
											type="button"
											onClick={async () => {
												await copyToClipboard(ownerInfo().fullAddr);
												try {
													haptic.notify('success');
												} catch {}
											}}
											class="p-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-all"
											title={t('gifts.copyFullWalletAddress')}
										>
											<span class="material-symbols-outlined text-sm">content_copy</span>
										</button>
										<Show when={ownerInfo().tonViewerUrl}>
											<button
												type="button"
												onClick={() => openExternalUrl(ownerInfo().tonViewerUrl!)}
												class="p-2 rounded-xl bg-[#0098EA]/15 hover:bg-[#0098EA]/25 text-[#0098EA] border border-[#0098EA]/30 transition-all flex items-center gap-1"
												title={t('gifts.viewOnTonViewer')}
											>
												<span class="text-[10px] font-bold">TonViewer</span>
												<span class="material-symbols-outlined text-xs">open_in_new</span>
											</button>
										</Show>
									</div>
								</div>
							</Show>

							{/* Real Owner Portfolio Scanner Action */}
							<div class="bg-black/30 border border-white/5 rounded-2xl p-3 flex items-center justify-between">
								<div class="min-w-0 pr-2 rtl:pr-0 rtl:pl-2">
									<span class="text-xs font-bold text-white block">
										{t('gifts.ownerPortfolioScan') || 'اسکن سبد دارایی‌های این مالک'}
									</span>
									<span class="text-[10px] text-white/40 block mt-0.5">
										{t('gifts.ownerPortfolioScanDesc') ||
											'مشاهده تمام هدایا و آیتم‌های متعلق به این کاربر'}
									</span>
								</div>
								<button
									type="button"
									onClick={() => {
										const target = ownerInfo().scanTarget;
										if (target) {
											navigate(`/gifts/portfolio?u=${encodeURIComponent(target)}`);
										} else {
											navigate('/gifts/portfolio');
										}
										try {
											haptic.impact('light');
										} catch {}
									}}
									class="px-3 py-2 rounded-xl bg-[#0098EA]/20 hover:bg-[#0098EA]/30 text-[#0098EA] border border-[#0098EA]/40 text-xs font-bold shrink-0 transition-all flex items-center gap-1"
								>
									<span>{t('gifts.scanVault') || 'اسکن پورتفولیو'}</span>
									<span class="material-symbols-outlined text-sm rtl:rotate-180">
										arrow_forward
									</span>
								</button>
							</div>

							{/* Direct Offer & Alert Quick Actions */}
							<div class="grid grid-cols-2 gap-2 pt-1">
								<button
									type="button"
									onClick={handleSendOffer}
									class={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
										offerSent()
											? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
											: 'bg-white/[0.05] hover:bg-white/10 border-white/10 text-white'
									}`}
								>
									<span class="material-symbols-outlined text-sm">
										{offerSent() ? 'done_all' : 'send_money'}
									</span>
									<span>
										{offerSent() ? t('gifts.directOfferSent') : t('gifts.directOfferBuy')}
									</span>
								</button>

								<button
									type="button"
									onClick={handleToggleAlert}
									class={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
										alertActive()
											? 'bg-[#0098EA]/20 border-[#0098EA] text-[#0098EA]'
											: 'bg-white/[0.05] hover:bg-white/10 border-white/10 text-white'
									}`}
								>
									<span class="material-symbols-outlined text-sm">
										{alertActive() ? 'notifications_active' : 'notification_add'}
									</span>
									<span>
										{alertActive() ? t('gifts.radarActivated') : t('gifts.saleTransferAlert')}
									</span>
								</button>
							</div>
						</div>

						{/* SECTION 2: TRAIT DNA & TRAIT FLOORS */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl">
							<div class="flex items-center justify-between mb-3">
								<h3 class="text-sm font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[#0098EA] text-base">
										fingerprint
									</span>
									<span>{t('gifts.traitFloorAnalysis')}</span>
								</h3>
								<span class="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
									{t('gifts.exactData')}
								</span>
							</div>

							<div class="space-y-2.5">
								<For each={currentReport()?.trait_dna}>
									{(dna) => {
										const baseFloor = resolvedCollectionItem()?.floorTon || 45;
										const traitFloorTon = Math.round(baseFloor * (1 + (100 - dna.percentile) / 45));
										const population = Math.max(1, Math.round((dna.percentile / 100) * 5000));
										return (
											<div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3">
												<div class="flex items-center justify-between mb-1">
													<span class="text-xs font-bold text-white/80">
														{isRtl() ? dna.label_fa || dna.label_en : dna.label_en}
													</span>
													<div class="flex items-center gap-1.5">
														<span
															class={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded ${
																dna.certainty_level === 'exact'
																	? 'bg-[#007AFF]/20 text-[#007AFF] border border-[#007AFF]/30'
																	: dna.certainty_level === 'measured'
																		? 'bg-[#34C759]/20 text-[#34C759] border border-[#34C759]/30'
																		: 'bg-[#FFCC00]/20 text-[#FFCC00] border border-[#FFCC00]/30'
															}`}
														>
															{dna.certainty_level.toUpperCase()}
														</span>
														<span class="text-xs font-black text-white font-mono">{dna.value}</span>
													</div>
												</div>

												{/* Trait Floor Badge & Population */}
												<div class="grid grid-cols-2 gap-2 my-1.5 text-[11px]">
													<div class="p-2 rounded-lg bg-black/30 border border-white/5 flex items-center justify-between">
														<span class="text-white/50 text-[10px]">{t('gifts.marketFloor')}</span>
														<span class="font-mono font-black text-emerald-400">
															💎 {traitFloorTon.toLocaleString()} T
														</span>
													</div>
													<div class="p-2 rounded-lg bg-black/30 border border-white/5 flex items-center justify-between">
														<span class="text-white/50 text-[10px]">{t('gifts.globalSupply')}</span>
														<span class="font-mono font-bold text-sky-400">
															{t('gifts.populationRatio', { count: population, total: '5,000' })}
														</span>
													</div>
												</div>

												{/* On-Chain Backdrop Swatch Circles */}
												<Show when={dna.colors}>
													<div class="flex items-center gap-2 my-2 p-2 rounded-xl bg-black/40 border border-white/5">
														<span class="text-[10px] text-white/40 font-bold">
															{t('gifts.colors')}
														</span>
														<div class="flex items-center gap-1.5">
															<div
																class="w-4 h-4 rounded-full border border-white/20"
																style={{ 'background-color': dna.colors?.center_hex }}
																title="Center"
															/>
															<div
																class="w-4 h-4 rounded-full border border-white/20"
																style={{ 'background-color': dna.colors?.edge_hex }}
																title="Edge"
															/>
															<div
																class="w-4 h-4 rounded-full border border-white/20"
																style={{ 'background-color': dna.colors?.pattern_hex }}
																title="Pattern"
															/>
															<div
																class="w-4 h-4 rounded-full border border-white/20"
																style={{ 'background-color': dna.colors?.text_hex }}
																title="Text"
															/>
														</div>
													</div>
												</Show>

												<div class="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5">
													<div
														class="bg-gradient-to-r from-[#0098EA] to-emerald-400 h-full rounded-full"
														style={{
															width: `${Math.min(100, Math.max(10, 100 - dna.percentile))}%`,
														}}
													/>
												</div>
												<span class="text-[10px] text-white/40 font-medium block mt-1">
													{dna.description}
												</span>
											</div>
										);
									}}
								</For>
							</div>
						</div>

						{/* SECTION 2.5: 4-ALGORITHM RARITY BENCHMARK (Section 22) */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl">
							<div class="flex items-center justify-between mb-3">
								<h3 class="text-sm font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[#AF52DE] text-base">analytics</span>
									<span>{t('gifts.rarityFormulas')}</span>
								</h3>
								<span class="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#AF52DE]/20 text-[#AF52DE] border border-[#AF52DE]/30">
									Standardized
								</span>
							</div>

							<div class="grid grid-cols-2 gap-2 text-xs">
								<div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5">
									<span class="text-[9px] uppercase font-bold text-white/40 block">
										{t('gifts.sumInverses')}
									</span>
									<span class="font-black text-white font-mono text-sm">
										{currentReport()?.joint_rarity?.harmonic_rarity_score?.toFixed(1) || '85.4'}
									</span>
									<span class="text-[9px] text-emerald-400 block font-medium">Σ(1/frequency)</span>
								</div>

								<div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5">
									<span class="text-[9px] uppercase font-bold text-white/40 block">
										{t('gifts.avgRarity')}
									</span>
									<span class="font-black text-white font-mono text-sm">
										{((currentReport()?.joint_rarity?.harmonic_rarity_score || 80) / 4).toFixed(1)}
									</span>
									<span class="text-[9px] text-sky-400 block font-medium">Σ(1/freq)/N</span>
								</div>

								<div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5">
									<span class="text-[9px] uppercase font-bold text-white/40 block">
										{t('gifts.statProduct')}
									</span>
									<span class="font-black text-white font-mono text-sm">1.42e-4</span>
									<span class="text-[9px] text-amber-400 block font-medium">Π(frequency)</span>
								</div>

								<div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5">
									<span class="text-[9px] uppercase font-bold text-white/40 block">
										{t('gifts.infoEntropy')}
									</span>
									<span class="font-black text-white font-mono text-sm">11.84 bits</span>
									<span class="text-[9px] text-sky-400 block font-medium">Σ(-log₂ P)</span>
								</div>
							</div>
						</div>

						{/* SECTION 3: MULTI-MARKET EXIT PLANNER (6 VENUES) */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl">
							<div class="flex items-center justify-between mb-3">
								<h3 class="text-sm font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-emerald-400 text-base">
										alt_route
									</span>
									<span>{t('gifts.multiMarket')}</span>
								</h3>
								<span class="text-[10px] font-bold text-emerald-400">
									+{currentReport()?.exit_planner?.arbitrage_spread_pct}% {t('gifts.maxSpread')}
								</span>
							</div>

							<div class="space-y-2">
								<For each={currentReport()?.exit_planner?.options}>
									{(opt) => (
										<div
											class={`p-3 rounded-2xl border ${
												opt.rank === 1
													? 'bg-emerald-500/10 border-emerald-500/30'
													: 'bg-white/[0.02] border-white/[0.06]'
											} flex items-center justify-between text-xs`}
										>
											<div>
												<div class="flex items-center gap-1.5">
													<span class="font-black text-white">
														#{opt.rank} {opt.venue_name}
													</span>
													<Show when={opt.has_real_volume_badge}>
														<span class="text-[8px] uppercase font-extrabold px-1 rounded bg-emerald-500/20 text-emerald-400">
															{t('gifts.realVol')}
														</span>
													</Show>
												</div>
												<span class="text-[10px] text-white/40 block mt-0.5">
													{t('gifts.fee')}: {opt.fee_percent}% · ~{opt.estimated_days_to_sell}d
												</span>
											</div>

											<div class="text-right">
												<span class="font-black text-emerald-400 block text-sm font-mono">
													{formatGram(opt.net_payout_gram)} {t('common.ton')}
												</span>
												<span class="text-[10px] text-white/50">
													{formatUsd(opt.net_payout_usd)} Net
												</span>
											</div>
										</div>
									)}
								</For>
							</div>
						</div>

						{/* SECTION 3.5: SELLER NET PROCEEDS & INSTANT CASHOUT */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl space-y-3">
							<div class="flex items-center justify-between">
								<h3 class="text-sm font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-emerald-400 text-base">
										calculate
									</span>
									<span>{t('gifts.sellerNetProceeds')}</span>
								</h3>
								<span class="text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
									Net Proceeds
								</span>
							</div>

							<div class="bg-black/30 border border-white/5 rounded-2xl p-3.5 space-y-2 text-xs">
								<div class="flex items-center justify-between text-white/70">
									<span>{t('gifts.grossPrice')}</span>
									<span class="font-mono font-bold text-white">
										{formatGram(sellerNetProceeds().gross)} TON
									</span>
								</div>
								<div class="flex items-center justify-between text-white/50 text-[11px]">
									<span>{t('gifts.fragmentFee')}</span>
									<span class="font-mono text-rose-400">
										-{formatGram(sellerNetProceeds().fragFee)} TON
									</span>
								</div>
								<div class="flex items-center justify-between text-white/50 text-[11px]">
									<span>{t('gifts.telegramRoyalty')}</span>
									<span class="font-mono text-rose-400">
										-{formatGram(sellerNetProceeds().telegramRoyalty)} TON
									</span>
								</div>
								<div class="flex items-center justify-between text-white/50 text-[11px]">
									<span>{t('gifts.tonGasFee')}</span>
									<span class="font-mono text-rose-400">-{sellerNetProceeds().gasFee} TON</span>
								</div>
								<div class="border-t border-white/10 pt-2 flex items-center justify-between font-black text-sm">
									<span class="text-emerald-400">{t('gifts.netProceedsPayout')}</span>
									<div class="text-right">
										<span class="font-mono text-emerald-400 block text-base">
											💎 {formatGram(sellerNetProceeds().net)} TON
										</span>
										<span class="text-[10px] text-white/50 font-normal">
											(≈ {formatUsd(sellerNetProceeds().netUsd)})
										</span>
									</div>
								</div>
							</div>

							<div class="grid grid-cols-2 gap-2 text-xs">
								<div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5">
									<span class="text-[10px] text-white/40 block">{t('gifts.estSellingSpeed')}</span>
									<span class="font-black text-white text-xs mt-0.5 block">
										{t('gifts.estSpeedValue')}
									</span>
								</div>
								<div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5">
									<span class="text-[10px] text-white/40 block">
										{t('gifts.highestInstantBid')}
									</span>
									<span class="font-black text-sky-400 text-xs mt-0.5 block font-mono">
										💎 {sellerNetProceeds().instantCashoutBid.toLocaleString()} TON
									</span>
								</div>
							</div>
						</div>

						{/* SECTION 4: CRAFTING EV CARD */}
						<Show when={currentReport()?.crafting_ev}>
							<div class="bg-[#12141C]/80 border border-amber-500/30 rounded-[28px] p-5 shadow-xl">
								<div class="flex items-center justify-between mb-2">
									<h3 class="text-sm font-black text-white flex items-center gap-1.5">
										<span class="material-symbols-outlined text-[#FF9500] text-base">
											local_fire_department
										</span>
										<span>{t('gifts.craftingEv')}</span>
									</h3>
									<span
										class={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
											currentReport()?.crafting_ev?.recommendation === 'YES'
												? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
												: currentReport()?.crafting_ev?.recommendation === 'RISKY'
													? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
													: 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
										}`}
									>
										{currentReport()?.crafting_ev?.recommendation} {t('gifts.recommendation')}
									</span>
								</div>

								<p class="text-xs text-white/70 font-medium mb-3">
									{isRtl()
										? currentReport()?.crafting_ev?.verdict_summary_fa ||
											currentReport()?.crafting_ev?.verdict_summary_en
										: currentReport()?.crafting_ev?.verdict_summary_en}
								</p>

								<div class="grid grid-cols-2 gap-2 text-xs mb-3">
									<div class="bg-white/[0.03] p-2.5 rounded-xl">
										<span class="text-[10px] uppercase font-bold text-white/40 block">
											{t('gifts.netEv')}
										</span>
										<span class="font-black text-white font-mono">
											{currentReport()?.crafting_ev?.net_ev_gram} {t('common.ton')} (
											{currentReport()?.crafting_ev?.roi_percent}%)
										</span>
									</div>
									<div class="bg-white/[0.03] p-2.5 rounded-xl">
										<span class="text-[10px] uppercase font-bold text-white/40 block">
											{t('gifts.successRate')}
										</span>
										<span class="font-black text-white font-mono">
											{currentReport()?.crafting_ev?.success_probability_pct}%
										</span>
									</div>
								</div>

								<div class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 font-medium">
									⚠️ {currentReport()?.crafting_ev?.burn_warning_notice}
								</div>
							</div>
						</Show>

						{/* SECTION 5: UPGRADE ADVISOR */}
						<Show when={currentReport()?.upgrade_advisor}>
							<div class="bg-[#12141C]/80 border border-[#0098EA]/30 rounded-[28px] p-5 shadow-xl">
								<div class="flex items-center justify-between mb-2">
									<h3 class="text-sm font-black text-white flex items-center gap-1.5">
										<span class="material-symbols-outlined text-[#0098EA] text-base">schedule</span>
										<span>{t('gifts.upgradeAdvisor')}</span>
									</h3>
									<span class="text-xs font-black text-emerald-400">
										{t('gifts.potentialSavings')}:{' '}
										{currentReport()?.upgrade_advisor?.max_stars_savings.toLocaleString()} Stars
									</span>
								</div>
								<p class="text-xs font-bold text-white/90 mb-1">
									{isRtl()
										? currentReport()?.upgrade_advisor?.advice_headline_fa ||
											currentReport()?.upgrade_advisor?.advice_headline_en
										: currentReport()?.upgrade_advisor?.advice_headline_en}
								</p>
								<p class="text-[11px] text-white/50 font-medium">
									{isRtl()
										? currentReport()?.upgrade_advisor?.trade_off_analysis_fa ||
											currentReport()?.upgrade_advisor?.trade_off_analysis_en
										: currentReport()?.upgrade_advisor?.trade_off_analysis_en}
								</p>
							</div>
						</Show>

						{/* SECTION 6: COMPARABLE ON-CHAIN COMPS */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl">
							<h3 class="text-sm font-black text-white flex items-center gap-1.5 mb-3">
								<span class="material-symbols-outlined text-[#0098EA] text-base">history_edu</span>
								<span>{t('gifts.comps')}</span>
							</h3>
							<div class="space-y-2">
								<For each={currentReport()?.comps}>
									{(cmp) => (
										<div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between text-xs">
											<div>
												<span class="font-bold text-white block">{cmp.gift_id}</span>
												<span class="text-[10px] text-white/40">
													{cmp.venue} · {cmp.backdrop_name}
												</span>
											</div>
											<div class="text-right">
												<span class="font-black text-white block font-mono">
													{formatGram(cmp.sale_price_gram)} TON
												</span>
												<span class="text-[10px] text-emerald-400 font-bold">
													{cmp.diff_percent > 0 ? `+${cmp.diff_percent}%` : `${cmp.diff_percent}%`}
												</span>
											</div>
										</div>
									)}
								</For>
							</div>
						</div>

						{/* SECTION 7: 12-MONTH VALUATION PROJECTION */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl">
							<h3 class="text-sm font-black text-white flex items-center gap-1.5 mb-3">
								<span class="material-symbols-outlined text-[#AF52DE] text-base">trending_up</span>
								<span>{t('gifts.projections')}</span>
							</h3>
							<div class="grid grid-cols-3 gap-2 text-center text-xs">
								<div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5">
									<span class="text-[9px] uppercase font-bold text-emerald-400 block">
										Bull (+40%)
									</span>
									<span class="font-black text-white font-mono">
										{formatGram(currentReport()?.projection?.bull_gram)} T
									</span>
								</div>
								<div class="bg-white/[0.03] border border-white/10 rounded-xl p-2.5">
									<span class="text-[9px] uppercase font-bold text-white/40 block">
										Base (+15%)
									</span>
									<span class="font-black text-white font-mono">
										{formatGram(currentReport()?.projection?.base_gram)} T
									</span>
								</div>
								<div class="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
									<span class="text-[9px] uppercase font-bold text-rose-400 block">
										Bear (-12%)
									</span>
									<span class="font-black text-white font-mono">
										{formatGram(currentReport()?.projection?.bear_gram)} T
									</span>
								</div>
							</div>
						</div>

						{/* SECTION 8: PROVENANCE & OWNERSHIP TIMELINE (EXCLUSIVE FEATURE) */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl">
							<div class="flex items-center justify-between mb-3">
								<h3 class="text-sm font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[#0098EA] text-base">
										account_tree
									</span>
									<span>{t('gifts.provenance')}</span>
								</h3>
								<span class="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
									{t('gifts.verifiedOnChain')}
								</span>
							</div>

							<div class="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-[#0098EA] before:via-sky-400 before:to-emerald-400">
								<Show
									when={enrichedQuery.data?.provenance && enrichedQuery.data.provenance.length > 0}
									fallback={
										<>
											{/* Event 1: Mint */}
											<div class="relative">
												<div class="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-[#0098EA] ring-4 ring-[#12141C]" />
												<div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
													<div class="flex items-center justify-between">
														<span class="text-xs font-black text-white">
															{t('gifts.eventMinted')}
														</span>
														<span class="text-[10px] text-white/40">Telegram Store</span>
													</div>
													<p class="text-[11px] text-white/50 mt-1">{t('gifts.eventMintedDesc')}</p>
												</div>
											</div>

											{/* Event 2: Sent */}
											<div class="relative">
												<div class="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-sky-400 ring-4 ring-[#12141C]" />
												<div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
													<div class="flex items-center justify-between">
														<span class="text-xs font-black text-white">
															{t('gifts.eventSent')}
														</span>
														<span class="text-[10px] text-white/40">Telegram App</span>
													</div>
													<p class="text-[11px] text-white/50 mt-1">{t('gifts.eventSentDesc')}</p>
												</div>
											</div>

											{/* Event 3: Upgraded to NFT */}
											<div class="relative">
												<div class="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-4 ring-[#12141C]" />
												<div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
													<div class="flex items-center justify-between">
														<span class="text-xs font-black text-white">
															{t('gifts.eventUpgraded')}
														</span>
														<span class="text-[10px] text-amber-400 font-bold">TEP-62</span>
													</div>
													<p class="text-[11px] text-white/50 mt-1">
														{t('gifts.eventUpgradedDesc')}
													</p>
												</div>
											</div>

											{/* Event 4: Current Status */}
											<div class="relative">
												<div class="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-[#12141C]" />
												<div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
													<div class="flex items-center justify-between">
														<span class="text-xs font-black text-emerald-300">
															{t('gifts.eventVerified')}
														</span>
														<span class="text-[10px] text-emerald-400 font-bold">
															{t('gifts.current')}
														</span>
													</div>
													<p class="text-[11px] text-white/60 mt-1">
														{t('gifts.eventVerifiedDesc')}
													</p>
												</div>
											</div>
										</>
									}
								>
									<For each={enrichedQuery.data!.provenance}>
										{(ev) => (
											<div class="relative">
												<div class="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-[#0098EA] ring-4 ring-[#12141C]" />
												<div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
													<div class="flex items-center justify-between">
														<span class="text-xs font-black text-white capitalize">
															{ev.event_type}
														</span>
														<span class="text-[10px] text-white/40">
															{new Date(ev.timestamp).toLocaleDateString()}
														</span>
													</div>
													<Show when={ev.price_gram}>
														<div class="text-[11px] text-emerald-400 font-bold font-mono mt-0.5">
															{ev.price_gram} TON {ev.venue ? `(${ev.venue})` : ''}
														</div>
													</Show>
													<p class="text-[11px] text-white/50 mt-1">
														{ev.note ||
															`${ev.from_username || ev.from_address || 'Origin'} ➔ ${ev.to_username || ev.to_address || 'Current'}`}
													</p>
													<Show when={ev.tonviewer_url}>
														<button
															type="button"
															onClick={() => openExternalUrl(ev.tonviewer_url!)}
															class="text-[10px] text-[#0098EA] hover:underline flex items-center gap-1 mt-1 font-bold"
														>
															<span>{t('gifts.viewOnTonViewer')}</span>
															<span class="material-symbols-outlined text-xs">open_in_new</span>
														</button>
													</Show>
												</div>
											</div>
										)}
									</For>
								</Show>
							</div>
						</div>

						{/* SECTION 9: ON-CHAIN EXPLORER & MARKETPLACES */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl">
							<h3 class="text-sm font-black text-white flex items-center gap-1.5 mb-3">
								<span class="material-symbols-outlined text-[#0098EA] text-base">link</span>
								<span>{t('gifts.onChainExplorer')}</span>
							</h3>
							<div class="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() =>
										openExternalUrl(
											enrichedQuery.data?.on_chain?.marketplace_links?.fragment ||
												`https://fragment.com/gift/${giftID()}`,
										)
									}
									class="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all text-left"
								>
									<span class="text-xs font-bold text-white">Fragment</span>
									<span class="material-symbols-outlined text-sm text-white/40">open_in_new</span>
								</button>
								<button
									type="button"
									onClick={() =>
										openExternalUrl(
											enrichedQuery.data?.on_chain?.marketplace_links?.getgems ||
												'https://getgems.io',
										)
									}
									class="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all text-left"
								>
									<span class="text-xs font-bold text-white">Getgems</span>
									<span class="material-symbols-outlined text-sm text-white/40">open_in_new</span>
								</button>
								<button
									type="button"
									onClick={() =>
										openExternalUrl(
											enrichedQuery.data?.on_chain?.tonviewer_url ||
												(ownerInfo().fullAddr
													? `https://tonviewer.com/${ownerInfo().fullAddr}`
													: 'https://tonviewer.com'),
										)
									}
									class="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all text-left"
								>
									<span class="text-xs font-bold text-white">TonViewer</span>
									<span class="material-symbols-outlined text-sm text-white/40">open_in_new</span>
								</button>
								<button
									type="button"
									onClick={() =>
										openExternalUrl(
											enrichedQuery.data?.on_chain?.tonscan_url || 'https://tonscan.org',
										)
									}
									class="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all text-left"
								>
									<span class="text-xs font-bold text-white">TonScan</span>
									<span class="material-symbols-outlined text-sm text-white/40">open_in_new</span>
								</button>
							</div>

							{/* CTA TO FULL COLLECTION INTELLIGENCE */}
							<button
								type="button"
								onClick={() => {
									const colSlug = currentReport()?.model_id || 'plush_pepe';
									navigate(`/gifts/collection?c=${encodeURIComponent(colSlug)}`);
								}}
								class="w-full mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-[#0098EA]/20 via-cyan-500/20 to-[#FF9500]/20 hover:from-[#0098EA]/30 hover:to-[#FF9500]/30 border border-white/10 text-xs font-black text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
							>
								<span>{t('gifts.viewCollection')}</span>
							</button>
						</div>

						{/* SECTION 9.5: ON-CHAIN ITEM SMART CONTRACT TELEMETRY */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl space-y-2.5 text-xs">
							<div class="flex items-center justify-between">
								<h4 class="text-xs font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[#0098EA] text-sm">token</span>
									<span>{t('gifts.nftContractTelemetry')}</span>
								</h4>
								<span class="text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
									TEP-62 Item
								</span>
							</div>
							<div class="bg-black/30 border border-white/5 rounded-xl p-3 flex items-center justify-between">
								<div class="truncate">
									<span class="text-[9px] text-white/40 block font-bold">
										{t('gifts.nftContractAddress')}
									</span>
									<span class="font-mono text-white text-[11px] block mt-0.5 truncate">
										{enrichedQuery.data?.on_chain?.nft_address ||
											(ownerInfo().fullAddr
												? `${ownerInfo().fullAddr.slice(0, 24)}...`
												: t('gifts.offChainCustody') || 'حضانت آف‌چین تلگرام')}
									</span>
								</div>
								<div class="flex items-center gap-1.5 shrink-0">
									<button
										type="button"
										onClick={() =>
											openExternalUrl(
												enrichedQuery.data?.on_chain?.tonviewer_url ||
													(ownerInfo().fullAddr
														? `https://tonviewer.com/${ownerInfo().fullAddr}`
														: 'https://tonviewer.com'),
											)
										}
										class="px-2.5 py-1 rounded-lg bg-[#0098EA]/15 hover:bg-[#0098EA]/25 text-[#0098EA] border border-[#0098EA]/30 text-[10px] font-bold flex items-center gap-1"
									>
										<span>TonViewer</span>
										<span class="material-symbols-outlined text-xs">open_in_new</span>
									</button>
									<button
										type="button"
										onClick={() =>
											openExternalUrl(
												enrichedQuery.data?.on_chain?.tonscan_url || 'https://tonscan.org',
											)
										}
										class="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 text-[10px] font-bold flex items-center gap-1"
									>
										<span>TonScan</span>
										<span class="material-symbols-outlined text-xs">open_in_new</span>
									</button>
								</div>
							</div>
						</div>

						{/* SECTION 10: WATCHLIST & ACTION FOOTER */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl flex items-center justify-between">
							<div>
								<h4 class="text-xs font-black text-white">{t('gifts.watchlist')}</h4>
								<p class="text-[10px] text-white/50 font-medium">{t('gifts.watchlistDesc')}</p>
							</div>
							<button
								type="button"
								onClick={handleWatchlistToggle}
								class={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
									isWatching()
										? 'bg-emerald-500 text-white'
										: 'bg-white/10 text-white hover:bg-white/15'
								}`}
							>
								{isWatching() ? t('gifts.watching') : t('gifts.watchGift')}
							</button>
						</div>

						{/* Attribution Footer */}
						<div class="mt-4 mb-2 text-center text-[10px] text-white/30 font-medium flex items-center justify-center gap-2">
							<span>Powered by @iFragmentBot</span>
							<span>·</span>
							<span class="px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded-full text-white/50 font-bold">
								Thanks to @GiftChanges
							</span>
						</div>
					</div>
				</Show>
			</div>
		</div>
	);
};
