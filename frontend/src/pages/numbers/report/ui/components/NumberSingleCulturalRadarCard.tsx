import { type Component, For } from 'solid-js';
import type { CulturalScore } from '@/entities/numbers/model/types.js';
import { t } from '@/shared/i18n/index.js';
import { CULTURAL_RADAR_I18N, layaT, NUMBERS_I18N } from '@/shared/i18n/laya-i18n.js';
import { FragSectionHeader } from '@/shared/ui/fragment/FragmentPrimitives.js';

interface Props {
	radar?: CulturalScore[];
	number: string;
	layaReasoning?: any;
}

const localizeRegion = (key?: string, fallbackName?: string): string => {
	const k = (key || '').toLowerCase();
	if (k.includes('east') || k.includes('china') || k.includes('asia')) {
		return layaT(CULTURAL_RADAR_I18N.regions.east_asia);
	}
	if (k.includes('middle') || k.includes('mena') || k.includes('arab') || k.includes('iran')) {
		return layaT(CULTURAL_RADAR_I18N.regions.middle_east);
	}
	if (k.includes('cis') || k.includes('russia') || k.includes('euro')) {
		return layaT(CULTURAL_RADAR_I18N.regions.cis);
	}
	if (k.includes('global') || k.includes('west') || k.includes('web3')) {
		return layaT(CULTURAL_RADAR_I18N.regions.global);
	}
	return fallbackName || key || layaT(CULTURAL_RADAR_I18N.regions.global);
};

const localizeVerdict = (score: number): string => {
	if (score >= 85) return layaT(CULTURAL_RADAR_I18N.verdicts.elite);
	if (score >= 65) return layaT(CULTURAL_RADAR_I18N.verdicts.high);
	return layaT(CULTURAL_RADAR_I18N.verdicts.moderate);
};

export const NumberSingleCulturalRadarCard: Component<Props> = (props) => {
	const clean = () => (props.number || '').replace(/\D/g, '').replace(/^888/, '');

	const defaultScores = () => {
		const d = clean();
		const count8 = (d.match(/8/g) || []).length;
		const count4 = (d.match(/4/g) || []).length;
		const count7 = (d.match(/7/g) || []).length;
		const count0 = (d.match(/0/g) || []).length;

		let cn = 50 + count8 * 12 - count4 * 20;
		if (cn > 98) cn = 98;
		if (cn < 10) cn = 10;

		let mena = 60 + count0 * 8 + count7 * 10;
		if (mena > 96) mena = 96;

		let ru = 55 + (d.length <= 4 ? 30 : 15);
		if (ru > 95) ru = 95;

		let west = 50 + (d.includes('01') || d.includes('42') || d.length <= 4 ? 35 : 15);
		if (west > 95) west = 95;

		return [
			{
				region: layaT(CULTURAL_RADAR_I18N.regions.east_asia),
				score: cn,
				badge: layaT(CULTURAL_RADAR_I18N.verdicts.wealth8),
				color: '#ff5c6c',
			},
			{
				region: layaT(CULTURAL_RADAR_I18N.regions.middle_east),
				score: mena,
				badge: layaT(CULTURAL_RADAR_I18N.verdicts.vipCode),
				color: '#2990ff',
			},
			{
				region: layaT(CULTURAL_RADAR_I18N.regions.cis),
				score: ru,
				badge: layaT(CULTURAL_RADAR_I18N.verdicts.telecomMirror),
				color: '#4cd964',
			},
			{
				region: layaT(CULTURAL_RADAR_I18N.regions.global),
				score: west,
				badge: layaT(CULTURAL_RADAR_I18N.verdicts.web3Minimal),
				color: '#ffb340',
			},
		];
	};

	const radarList = () => {
		if (props.radar && props.radar.length > 0) {
			return props.radar.map((item) => ({
				region: localizeRegion(item.region_key, item.market_name),
				score: item.score,
				badge: localizeVerdict(item.score),
				color: item.score >= 80 ? '#4cd964' : item.score >= 60 ? '#2990ff' : '#ffb340',
			}));
		}
		return defaultScores();
	};

	return (
		<div class="frag-card-elevated rounded-[16px] p-4 sm:p-5 text-start flex flex-col gap-3.5 relative overflow-hidden">
			<FragSectionHeader
				title={layaT(NUMBERS_I18N.singleCulturalTitle)}
				subtitle={layaT(NUMBERS_I18N.singleCulturalSubtitle)}
				icon="radar"
				right={
					<span class="text-[10.5px] font-mono font-semibold text-[#2990ff] bg-[#2990ff]/12 border border-[#2990ff]/25 px-2 py-0.5 rounded-[6px]">
						{t('numReportCards.layaRadarBadge')}
					</span>
				}
			/>

			<div class="grid grid-cols-2 gap-2.5">
				<For each={radarList()}>
					{(r) => (
						<div class="frag-inset rounded-[12px] p-3 flex flex-col justify-between gap-2">
							<div class="flex items-center justify-between gap-1">
								<span class="text-[11px] font-semibold text-[#d7e0e8] truncate">{r.region}</span>
								<span
									class="text-[12.5px] font-mono font-semibold tabular-nums shrink-0"
									style={{ color: r.color }}
								>
									{r.score}%
								</span>
							</div>

							<div class="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
								<div
									class="h-full rounded-full transition-all duration-700"
									style={{ width: `${r.score}%`, 'background-color': r.color }}
								/>
							</div>

							<span class="text-[10.5px] font-mono text-[#60707c] truncate">{r.badge}</span>
						</div>
					)}
				</For>
			</div>

			<div class="frag-inset rounded-[12px] border-[#2990ff]/25 p-3 flex flex-col gap-1">
				<div class="flex items-center gap-1.5 text-[#2990ff] text-[11.5px] font-semibold">
					<span class="material-symbols-outlined text-[15px]">psychology</span>
					<span>{layaT(NUMBERS_I18N.layaCulturalVerdict)}</span>
				</div>
				<p class="text-[11.5px] text-[#c7d0d9] leading-relaxed">
					{layaT(NUMBERS_I18N.layaCulturalDefaultSummary)}
				</p>
			</div>
		</div>
	);
};
