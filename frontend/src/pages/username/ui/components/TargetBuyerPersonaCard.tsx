import { type Component, createSignal, For, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { BUYER_PERSONAS, layaT, USERNAME_I18N } from '@/shared/i18n/laya-i18n.js';
import { haptic } from '@/shared/lib/haptic.js';
import { FragSectionHeader } from '@/shared/ui/fragment/FragmentPrimitives.js';

interface Props {
	matchedArchetype?: string;
	detectedPersona?: any;
	username: string;
}

export const TargetBuyerPersonaCard: Component<Props> = (props) => {
	const [expanded, setExpanded] = createSignal(false);

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
		if (['pay', 'bank', 'cash', 'card', 'fund'].some((k) => u.includes(k)))
			return 'fintech_neobank';
		if (['news', 'media', 'daily', 'live', 'tv'].some((k) => u.includes(k))) return 'media_network';
		if (['bot', 'app', 'game', 'play', 'tap'].some((k) => u.includes(k))) return 'miniapp_operator';
		if (['guard', 'sec', 'shield', 'safe'].some((k) => u.includes(k))) return 'cyber_security';
		if (u.length <= 4) return 'domain_speculator';
		return 'web3_founder';
	};

	const matchedPersona = () =>
		BUYER_PERSONAS.find((p) => p.id === matchedId()) || BUYER_PERSONAS[0];

	const expandButtonText = () =>
		expanded() ? layaT(USERNAME_I18N.collapsePersonas) : layaT(USERNAME_I18N.viewAllPersonas);

	return (
		<div class="frag-card w-full p-4 flex flex-col gap-3.5 text-start">
			<FragSectionHeader
				icon="group"
				title={layaT(USERNAME_I18N.buyerPersonasTitle)}
				subtitle={layaT(USERNAME_I18N.buyerPersonasSubtitle)}
				right={
					<span class="h-[22px] px-2 rounded-[6px] inline-flex items-center text-[11px] font-mono text-[#ffb340] bg-[#ffb340]/10 border border-[#ffb340]/25">
						{t('valuation.archetypesCount', { count: 8 })}
					</span>
				}
			/>

			{/* Primary matched buyer profile */}
			<div class="frag-inset p-3.5 flex flex-col gap-2.5 !border-[#ffb340]/25">
				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center gap-1.5">
						<span class="w-1.5 h-1.5 rounded-full bg-[#ffb340]" />
						<span class="text-[11px] font-medium text-[#ffb340]">
							{layaT(USERNAME_I18N.layaMatch)}
						</span>
					</div>
					<span class="text-[11px] font-mono text-white bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded-[6px]">
						{matchedPersona().budgetRange}
					</span>
				</div>

				<div class="flex items-center gap-3">
					<div
						class="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
						style={{
							'background-color': `${matchedPersona().color}18`,
							border: `1px solid ${matchedPersona().color}40`,
						}}
					>
						<span
							class="material-symbols-outlined text-[20px]"
							style={{ color: matchedPersona().color }}
						>
							{matchedPersona().icon}
						</span>
					</div>
					<div class="flex flex-col min-w-0">
						<span class="text-[14px] font-semibold text-white truncate">
							{layaT(matchedPersona().title)}
						</span>
						<span class="text-[11px] text-[#8c9ba5] truncate">
							{layaT(matchedPersona().typicalHold)}
						</span>
					</div>
				</div>

				<p class="text-[12px] text-[#c7d0d9] leading-relaxed">
					{layaT(matchedPersona().rationale)}
				</p>
			</div>

			{/* Expandable 8 archetypes comparison table */}
			<button
				type="button"
				onClick={() => {
					try {
						haptic.selection();
					} catch {}
					setExpanded(!expanded());
				}}
				class="w-full h-10 rounded-[10px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white font-medium text-[12px] flex items-center justify-center gap-1.5 transition-colors"
			>
				<span>{expandButtonText()}</span>
				<span
					class={`material-symbols-outlined text-[16px] text-[#8c9ba5] transition-transform ${
						expanded() ? 'rotate-180' : ''
					}`}
				>
					expand_more
				</span>
			</button>

			<Show when={expanded()}>
				<div class="frag-table-container">
					<For each={BUYER_PERSONAS}>
						{(p) => {
							const isCurrent = () => p.id === matchedId();
							return (
								<div
									class={`frag-table-row p-3.5 flex flex-col gap-2 text-start ${
										isCurrent() ? '!bg-[#ffb340]/[0.07]' : ''
									}`}
								>
									<div class="flex items-center justify-between gap-2">
										<div class="flex items-center gap-2 min-w-0">
											<span
												class="material-symbols-outlined text-[17px] shrink-0"
												style={{ color: p.color }}
											>
												{p.icon}
											</span>
											<span class="text-[13px] font-semibold text-white truncate">
												{layaT(p.title)}
											</span>
										</div>
										<div class="flex items-center gap-1.5 shrink-0">
											<Show when={isCurrent()}>
												<span class="text-[10px] font-mono font-semibold bg-[#ffb340] text-black px-1.5 py-0.5 rounded-[5px]">
													{t('valuation.personaMatch')}
												</span>
											</Show>
											<span class="text-[11px] font-mono text-[#a9b6bf] bg-white/[0.05] px-2 py-0.5 rounded-[6px] border border-white/[0.07]">
												{p.budgetRange}
											</span>
										</div>
									</div>

									<p class="text-[11px] text-[#8c9ba5] leading-relaxed">{layaT(p.rationale)}</p>

									<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1.5 border-t border-white/[0.05] text-[11px]">
										<div class="flex items-baseline gap-1 text-[#60707c]">
											<span class="font-medium text-[#8c9ba5]">
												{layaT(USERNAME_I18N.holdStylePrefix)}
											</span>
											<span class="text-white/80 truncate">{layaT(p.typicalHold)}</span>
										</div>
										<div class="flex items-baseline gap-1 text-[#60707c] sm:justify-end">
											<span class="font-medium text-[#ffb340]">
												{layaT(USERNAME_I18N.urgencyPrefix)}
											</span>
											<span class="text-white/80 truncate">{layaT(p.urgency)}</span>
										</div>
									</div>
								</div>
							);
						}}
					</For>
				</div>
			</Show>
		</div>
	);
};
