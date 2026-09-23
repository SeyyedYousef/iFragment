import { type Component, createSignal, For, Show } from 'solid-js';
import { locale } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { layaT, USERNAME_I18N, BUYER_PERSONAS } from '@/shared/i18n/laya-i18n.js';

interface Props {
	matchedArchetype?: string;
	detectedPersona?: any;
	username: string;
}

export const TargetBuyerPersonaCard: Component<Props> = (props) => {
	const [expanded, setExpanded] = createSignal(false);

	// Algorithmic mapping of handle to buyer persona
	const matchedId = () => {
		if (props.matchedArchetype) {
			const a = props.matchedArchetype.toLowerCase();
			if (a.includes('whale')) return 'ton_whale';
			if (a.includes('founder') || a.includes('protocol')) return 'web3_founder';
			if (a.includes('media') || a.includes('channel')) return 'media_network';
			if (a.includes('domain') || a.includes('speculat')) return 'domain_speculator';
			if (a.includes('fintech') || a.includes('bank')) return 'fintech_neobank';
			if (a.includes('fund') || a.includes('invest')) return 'crypto_hedgefund';
			if (a.includes('security') || a.includes('safe')) return 'cyber_security';
			if (a.includes('mini') || a.includes('bot')) return 'miniapp_operator';
		}

		const u = (props.username || '').toLowerCase();
		if (['ton', 'crypto', 'whale', 'dex', 'dao'].some((k) => u.includes(k))) return 'ton_whale';
		if (['pay', 'bank', 'cash', 'card', 'fund'].some((k) => u.includes(k))) return 'fintech_neobank';
		if (['news', 'media', 'daily', 'live', 'tv'].some((k) => u.includes(k))) return 'media_network';
		if (['bot', 'app', 'game', 'play', 'tap'].some((k) => u.includes(k))) return 'miniapp_operator';
		if (['guard', 'sec', 'shield', 'safe'].some((k) => u.includes(k))) return 'cyber_security';
		if (u.length <= 4) return 'domain_speculator';
		return 'web3_founder';
	};

	const matchedPersona = () =>
		BUYER_PERSONAS.find((p) => p.id === matchedId()) || BUYER_PERSONAS[0];

	const expandButtonText = () => {
		const loc = locale();
		if (expanded()) {
			if (loc === 'fa') return 'بستن لیست کامل پرسوناها';
			if (loc === 'ru') return 'Свернуть список покупателей';
			if (loc === 'zh') return '收起完整画像列表';
			return 'Collapse Full Personas';
		}
		if (loc === 'fa') return 'مشاهده تحلیل جامع ۸ پرسونای خریدار واقعی';
		if (loc === 'ru') return 'Показать все 8 профилей покупателей';
		if (loc === 'zh') return '查看全部 8 类真实买家画像';
		return 'View All 8 Buyer Personas Matrix';
	};

	return (
		<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 flex flex-col gap-4 text-start shadow-xl relative overflow-hidden">
			{/* Ambient Tint Glow */}
			<div class="absolute -right-12 -top-12 w-36 h-36 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />

			{/* Card Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3 relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[14px] bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
						<span class="material-symbols-outlined text-[20px]">group</span>
					</div>
					<div class="flex flex-col">
						<h4 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{layaT(USERNAME_I18N.buyerPersonasTitle)}
						</h4>
						<span class="text-[9px] font-mono text-white/40">
							{layaT(USERNAME_I18N.buyerPersonasSubtitle)}
						</span>
					</div>
				</div>
				<span class="text-[9px] font-mono font-black text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-md">
					8 ARCHETYPES
				</span>
			</div>

			{/* Primary Match Spotlight Banner */}
			<div class="w-full bg-gradient-to-r from-amber-500/15 via-[#08090D] to-[#08090D] border border-amber-500/30 rounded-[22px] p-4 flex flex-col gap-2 relative overflow-hidden">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
						<span class="text-[10px] font-mono font-black text-amber-300 uppercase tracking-wider">
							{layaT(USERNAME_I18N.layaMatch)}
						</span>
					</div>
					<span class="text-[10px] font-mono font-black text-white bg-white/10 border border-white/10 px-2 py-0.5 rounded-md">
						{matchedPersona().budgetRange}
					</span>
				</div>

				<div class="flex items-center gap-3 pt-1">
					<div
						class="w-10 h-10 rounded-[14px] flex items-center justify-center text-white shrink-0 shadow-md"
						style={{
							'background-color': `${matchedPersona().color}25`,
							border: `1px solid ${matchedPersona().color}60`,
						}}
					>
						<span
							class="material-symbols-outlined text-[22px]"
							style={{ color: matchedPersona().color }}
						>
							{matchedPersona().icon}
						</span>
					</div>
					<div class="flex flex-col">
						<span class="text-[14px] font-black text-white font-mono">
							{layaT(matchedPersona().title)}
						</span>
						<span class="text-[10px] text-white/50 font-mono">
							{layaT(matchedPersona().typicalHold)}
						</span>
					</div>
				</div>

				<p class="text-[11px] text-white/80 leading-relaxed pt-1 font-sans">
					{layaT(matchedPersona().rationale)}
				</p>
			</div>

			{/* Expandable All 8 Personas Breakdown */}
			<div class="w-full flex flex-col gap-2 pt-1">
				<button
					type="button"
					onClick={() => {
						try {
							haptic.selection();
						} catch {}
						setExpanded(!expanded());
					}}
					class="w-full h-11 rounded-[16px] bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
				>
					<span>{expandButtonText()}</span>
					<span
						class={`material-symbols-outlined text-[16px] transition-transform ${
							expanded() ? 'rotate-180' : ''
						}`}
					>
						expand_more
					</span>
				</button>

				<Show when={expanded()}>
					<div class="grid grid-cols-1 gap-2.5 pt-2">
						<For each={BUYER_PERSONAS}>
							{(p) => {
								const isCurrent = () => p.id === matchedId();
								return (
									<div
										class={`p-3.5 rounded-[20px] border flex flex-col gap-2 transition-all text-start ${
											isCurrent()
												? 'bg-amber-500/10 border-amber-500/40 shadow-md'
												: 'bg-[#08090D] border-white/5'
										}`}
									>
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<span
													class="material-symbols-outlined text-[18px]"
													style={{ color: p.color }}
												>
													{p.icon}
												</span>
												<span class="text-[12px] font-black text-white font-mono">
													{layaT(p.title)}
												</span>
											</div>
											<div class="flex items-center gap-1.5">
												<Show when={isCurrent()}>
													<span class="text-[8px] font-mono font-bold bg-amber-400 text-black px-1.5 py-0.5 rounded">
														MATCH
													</span>
												</Show>
												<span class="text-[9px] font-mono text-white/60 bg-white/5 px-2 py-0.5 rounded border border-white/10">
													{p.budgetRange}
												</span>
											</div>
										</div>

										<p class="text-[10px] text-white/70 leading-relaxed font-sans">
											{layaT(p.rationale)}
										</p>

										<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1.5 border-t border-white/5 text-[9px] font-mono">
											<div class="flex items-baseline gap-1 text-white/40">
												<span class="font-bold text-white/60">
													{layaT(USERNAME_I18N.holdStylePrefix)}
												</span>
												<span class="text-white/80">{layaT(p.typicalHold)}</span>
											</div>
											<div class="flex items-baseline gap-1 text-white/40 sm:justify-end">
												<span class="font-bold text-amber-400/80">
													{layaT(USERNAME_I18N.urgencyPrefix)}
												</span>
												<span class="text-white/80">{layaT(p.urgency)}</span>
											</div>
										</div>
									</div>
								);
							}}
						</For>
					</div>
				</Show>
			</div>
		</div>
	);
};
