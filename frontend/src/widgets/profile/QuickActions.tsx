import { Motion } from '@motionone/solid';
import { Component, For } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { addToHomeScreen, haptic, openTelegramLink } from '@/shared/lib/telegram-native.js';

interface QuickActionsProps {
	onRedeemClick?: () => void;
}

export const QuickActions: Component<QuickActionsProps> = (props) => {
	const actions = [
		{
			id: 'home_screen',
			icon: 'install_mobile',
			color: '#3390ec',
			label: t('profile.addToHome') || 'Add to Home',
			onClick: () => {
				haptic.impact('light');
				addToHomeScreen();
			},
		},
		{
			id: 'redeem_promo',
			icon: 'redeem',
			color: '#ffcc00',
			label: t('profile.redeemCode') || 'Gift Code',
			onClick: () => {
				haptic.impact('light');
				if (props.onRedeemClick) props.onRedeemClick();
			},
		},
		{
			id: 'support',
			icon: 'support_agent',
			color: '#00c7e2',
			label: t('profile.support') || 'Support',
			onClick: () => {
				haptic.impact('light');
				openTelegramLink('https://t.me/iFragmentSupport');
			},
		},
	];

	return (
		<Motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.3 }}
			class="mx-6 mt-4 grid grid-cols-3 gap-2"
		>
			<For each={actions}>
				{(action) => (
					<button
						onClick={action.onClick}
						class="bg-[#1c1c1c] rounded-2xl p-3 border border-[#2a2a2a] flex flex-col items-center justify-center gap-1.5 hover:bg-[#2a2a2a] transition-colors active:scale-95 min-h-[72px]"
					>
						<span
							class="material-symbols-outlined text-[20px]"
							style={{ color: action.color, 'font-variation-settings': '"FILL" 1' }}
						>
							{action.icon}
						</span>
						<span class="text-[#a0a4ad] text-[9px] font-bold text-center leading-tight">
							{action.label}
						</span>
					</button>
				)}
			</For>
		</Motion.div>
	);
};
