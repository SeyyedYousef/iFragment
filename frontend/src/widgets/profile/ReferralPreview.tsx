import { Motion } from '@motionone/solid';
import { initData } from '@tma.js/sdk-solid';
import { Component, createSignal } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import {
	copyToClipboard,
	haptic,
	shareToStory,
	showScanQrPopup,
	switchInlineQuery,
} from '@/shared/lib/telegram-native.js';
import type { ReferralInfo } from '@/shared/store/profile.js';

interface Props {
	referral: ReferralInfo | null;
}

export const ReferralPreview: Component<Props> = (props) => {
	let user: any = null;
	try {
		user = initData.user();
	} catch (e) {}
	const [copied, setCopied] = createSignal(false);

	const refLink = () =>
		`https://t.me/iFragmentBot?start=${props.referral?.referralCode || `ref_${user?.id || '0'}`}`;

	const handleCopy = async () => {
		await copyToClipboard(refLink());
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleShare = () => {
		haptic.impact('medium');
		switchInlineQuery(`Join iFragment! ${refLink()}`, ['users', 'groups']);
	};

	const handleScanQr = async () => {
		haptic.impact('light');
		await showScanQrPopup(t('profile.scanReferralQr') || 'Scan referral QR');
	};

	return (
		<Motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.25 }}
			class="mx-6 mt-4 bg-[#1c1c1c] rounded-3xl p-5 border border-[#2a2a2a]"
		>
			<div class="flex items-center gap-2 mb-4">
				<div class="w-8 h-8 rounded-xl bg-[#0f1014] flex items-center justify-center border border-[#2a2a2a]">
					<span
						class="material-symbols-outlined text-[18px] text-[#34c759]"
						style={{ 'font-variation-settings': '"FILL" 1' }}
					>
						group_add
					</span>
				</div>
				<span class="text-white font-black text-sm">
					{t('profile.referralHub') || 'Referral Hub'}
				</span>
			</div>

			{/* Stats row */}
			<div class="grid grid-cols-2 gap-2 mb-4">
				<div class="bg-[#0f1014] rounded-2xl p-3 border border-[#2a2a2a] text-center">
					<span class="text-white font-black text-xl">{props.referral?.totalInvited ?? 0}</span>
					<span class="text-[#a0a4ad] text-[10px] font-bold block mt-0.5">
						{t('profile.friendsInvited') || 'Friends Invited'}
					</span>
				</div>
				<div class="bg-[#0f1014] rounded-2xl p-3 border border-[#2a2a2a] text-center">
					<span class="text-[#34c759] font-black text-xl">
						{((props.referral?.totalEarned ?? 0) / 1000).toFixed(0)}K
					</span>
					<span class="text-[#a0a4ad] text-[10px] font-bold mt-0.5 flex items-center justify-center gap-1">
						<span class="text-[8px]">🟡</span> {t('profile.earned') || 'Earned'}
					</span>
				</div>
			</div>

			{/* Referral link */}
			<div class="bg-[#0f1014] rounded-2xl p-3 border border-[#2a2a2a] flex items-center gap-2 mb-3">
				<span class="text-[#a0a4ad] text-xs truncate flex-1 font-mono">{refLink()}</span>
				<button
					onClick={handleCopy}
					class="px-3 py-1.5 rounded-xl bg-[#3390ec]/15 border border-[#3390ec]/30 text-[#3390ec] font-bold text-[11px] flex-shrink-0"
				>
					{copied() ? '✓' : t('profile.copy') || 'Copy'}
				</button>
			</div>

			{/* Action buttons */}
			<div class="grid grid-cols-3 gap-2">
				<button
					onClick={handleShare}
					class="py-2.5 rounded-2xl bg-[#3390ec]/10 border border-[#3390ec]/20 flex flex-col items-center gap-1 hover:bg-[#3390ec]/20 transition-colors"
				>
					<span class="material-symbols-outlined text-[18px] text-[#3390ec]">share</span>
					<span class="text-[#3390ec] text-[10px] font-bold">{t('profile.share') || 'Share'}</span>
				</button>
				<button
					onClick={() => {
						haptic.impact('light');
						shareToStory(refLink(), { text: 'Join me on iFragment!' });
					}}
					class="py-2.5 rounded-2xl bg-[#ff9500]/10 border border-[#ff9500]/20 flex flex-col items-center gap-1 hover:bg-[#ff9500]/20 transition-colors"
				>
					<span class="material-symbols-outlined text-[18px] text-[#ff9500]">auto_stories</span>
					<span class="text-[#ff9500] text-[10px] font-bold">{t('profile.story') || 'Story'}</span>
				</button>
				<button
					onClick={handleScanQr}
					class="py-2.5 rounded-2xl bg-[#00c7e2]/10 border border-[#00c7e2]/20 flex flex-col items-center gap-1 hover:bg-[#00c7e2]/20 transition-colors"
				>
					<span class="material-symbols-outlined text-[18px] text-[#00c7e2]">qr_code_scanner</span>
					<span class="text-[#00c7e2] text-[10px] font-bold">{t('profile.scanQr') || 'Scan'}</span>
				</button>
			</div>
		</Motion.div>
	);
};
