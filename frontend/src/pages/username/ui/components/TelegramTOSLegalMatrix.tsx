import { type Component, Show } from 'solid-js';
import { locale } from '@/shared/i18n/index.js';
import { layaT, USERNAME_I18N } from '@/shared/i18n/laya-i18n.js';
import { FragSectionHeader } from '@/shared/ui/fragment/FragmentPrimitives.js';

export interface TrademarkRiskData {
	risk_level?: string; // "low" | "medium" | "high"
	severity?: string; // "none" | "exact_match" | "substring" | "tld_squat"
	matched_entity?: string;
	brand?: string;
	advisory_warning?: string;
	advisory_warnings?: Record<string, string>;
	risk_score?: number;
}

interface Props {
	trademarkRisk?: TrademarkRiskData | null;
	username: string;
}

const interpolate = (template: string, brand: string, entity: string): string =>
	template.replace(/\{brand\}/g, brand).replace(/\{entity\}/g, entity);

export const TelegramTOSLegalMatrix: Component<Props> = (props) => {
	const riskLevel = () => (props.trademarkRisk?.risk_level || 'low').toLowerCase();
	const severity = () => (props.trademarkRisk?.severity || '').toLowerCase();

	const riskScore = () => {
		if (props.trademarkRisk?.risk_score !== undefined && props.trademarkRisk.risk_score !== null) {
			return props.trademarkRisk.risk_score;
		}
		if (riskLevel() === 'high') return 92;
		if (riskLevel() === 'medium') return 65;
		return 10;
	};

	const isHighRisk = () => riskLevel() === 'high' || riskScore() >= 80;
	const isMediumRisk = () => riskLevel() === 'medium' || (riskScore() >= 50 && riskScore() < 80);

	const toneColor = () => (isHighRisk() ? '#ff5c6c' : isMediumRisk() ? '#ffb340' : '#4cd964');

	const riskBadgeText = () => {
		if (isHighRisk()) return layaT(USERNAME_I18N.riskHigh);
		if (isMediumRisk()) return layaT(USERNAME_I18N.riskMedium);
		return layaT(USERNAME_I18N.riskClean);
	};

	const severityTagText = () => {
		const sev = severity();
		if (sev === 'exact_match') return layaT(USERNAME_I18N.severityExactBadge);
		if (sev === 'tld_squat') return layaT(USERNAME_I18N.severitySquatBadge);
		if (sev === 'substring') return layaT(USERNAME_I18N.severitySubstringBadge);
		return '';
	};

	const advisoryText = () => {
		const loc = locale() || 'en';
		const localizedMap = props.trademarkRisk?.advisory_warnings;
		if (localizedMap?.[loc]) {
			return localizedMap[loc];
		}

		const brand = props.trademarkRisk?.brand || '';
		const entity = props.trademarkRisk?.matched_entity || brand;
		const sev = severity();
		const disclaimer = layaT(USERNAME_I18N.advisoryDisclaimer);

		if (brand) {
			if (sev === 'exact_match' || isHighRisk()) {
				return `${interpolate(layaT(USERNAME_I18N.advisoryExactMatch), brand, entity)} (${disclaimer})`;
			}
			if (sev === 'tld_squat') {
				return `${interpolate(layaT(USERNAME_I18N.advisorySquat), brand, entity)} (${disclaimer})`;
			}
			return `${interpolate(layaT(USERNAME_I18N.advisorySubstring), brand, entity)} (${disclaimer})`;
		}

		if (isHighRisk()) return `${layaT(USERNAME_I18N.advisoryHigh)} (${disclaimer})`;
		if (isMediumRisk()) return `${layaT(USERNAME_I18N.advisoryMedium)} (${disclaimer})`;
		return layaT(USERNAME_I18N.advisoryClean);
	};

	return (
		<div class="frag-card w-full p-4 flex flex-col gap-3.5 text-start">
			<FragSectionHeader
				icon="gavel"
				title={layaT(USERNAME_I18N.legalMatrixTitle)}
				subtitle={layaT(USERNAME_I18N.legalMatrixSubtitle)}
				right={
					<span
						class="h-[22px] px-2 rounded-[6px] inline-flex items-center text-[11px] font-medium whitespace-nowrap"
						style={{
							color: toneColor(),
							'background-color': `${toneColor()}18`,
							border: `1px solid ${toneColor()}35`,
						}}
					>
						{riskBadgeText()}
					</span>
				}
			/>

			{/* Legal index score row */}
			<div class="frag-inset px-3.5 py-3 flex items-center justify-between gap-3">
				<div class="flex flex-col gap-0.5">
					<span class="text-[11px] text-[#8c9ba5]">{layaT(USERNAME_I18N.legalIndexTitle)}</span>
					<div class="flex items-baseline gap-1.5 font-mono" dir="ltr">
						<span
							class="text-[24px] font-semibold tabular-nums leading-none"
							style={{ color: toneColor() }}
						>
							{riskScore()}
						</span>
						<span class="text-[11px] text-[#60707c]">/ 100</span>
					</div>
				</div>

				<Show when={props.trademarkRisk?.matched_entity || props.trademarkRisk?.brand}>
					<div class="flex flex-col items-end gap-1">
						<span class="text-[11px] text-[#8c9ba5]">
							{severityTagText() || layaT(USERNAME_I18N.directTrademarkMatch)}
						</span>
						<span
							class="text-[12px] font-mono font-semibold px-2 py-0.5 rounded-[6px]"
							style={{
								color: toneColor(),
								'background-color': `${toneColor()}18`,
								border: `1px solid ${toneColor()}45`,
							}}
							dir="ltr"
						>
							{props.trademarkRisk?.matched_entity || props.trademarkRisk?.brand}
						</span>
					</div>
				</Show>
				<Show when={!props.trademarkRisk?.matched_entity && !props.trademarkRisk?.brand}>
					<div class="inline-flex items-center gap-1.5 text-[#4cd964] text-[12px] font-medium">
						<span class="material-symbols-outlined filled-icon text-[16px]">verified</span>
						<span>{layaT(USERNAME_I18N.noInfringementDetected)}</span>
					</div>
				</Show>
			</div>

			<p class="text-[12px] text-[#c7d0d9] leading-relaxed">{advisoryText()}</p>

			{/* Telegram ToS Section 4 excerpt */}
			<div class="frag-inset p-3.5 flex flex-col gap-2.5">
				<div class="flex items-center justify-between border-b border-white/[0.06] pb-2">
					<div class="flex items-center gap-1.5">
						<span class="material-symbols-outlined text-[16px] text-[#2990FF]">policy</span>
						<span class="text-[12px] font-semibold text-white">
							{layaT(USERNAME_I18N.section4BoxTitle)}
						</span>
					</div>
					<a
						href="https://telegram.org/tos"
						target="_blank"
						rel="noopener noreferrer"
						class="text-[11px] font-medium text-[#2990FF] hover:underline inline-flex items-center gap-1"
					>
						<span>{layaT(USERNAME_I18N.readOfficialTos)}</span>
						<span class="material-symbols-outlined text-[13px]">north_east</span>
					</a>
				</div>

				<div class="p-2.5 rounded-[8px] bg-[#1b232d] border border-white/[0.06] text-[11px] text-[#a9b6bf] leading-relaxed">
					<strong class="text-white block mb-0.5 font-medium">
						{layaT(USERNAME_I18N.section4QuoteTitle)}
					</strong>
					<p class="italic">{layaT(USERNAME_I18N.section4Quote)}</p>
				</div>

				<p class="text-[11px] text-[#a9b6bf] leading-relaxed">
					<strong class="text-white font-medium">{layaT(USERNAME_I18N.legalAnalysisTitle)}</strong>{' '}
					{layaT(USERNAME_I18N.legalAnalysisText)}
				</p>
			</div>
		</div>
	);
};
