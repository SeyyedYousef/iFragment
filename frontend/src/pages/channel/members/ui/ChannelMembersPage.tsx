import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { type Component, createResource, createSignal, onCleanup, onMount } from 'solid-js';
import { ChannelContextBar, ChannelHamburgerMenu, channelApi } from '@/entities/channel/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';

export const ChannelMembersPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [memberIdInput, setMemberIdInput] = createSignal('');
	const [isBanning, setIsBanning] = createSignal(false);
	const [isRestricting, setIsRestricting] = createSignal(false);

	const [channelInfo] = createResource(
		() => params.id,
		(id) => channelApi.getChannel(id),
	);

	onMount(() => {
		try {
			if (backButton.isSupported() && backButton.mount.isAvailable()) {
				backButton.mount();
				backButton.show();
				backButton.onClick(() => {
					haptic.impact('light');
					navigate(`/channel/${params.id}/dashboard`);
				});
			}
		} catch (_e) {}
	});

	onCleanup(() => {
		try {
			if (backButton.isSupported()) {
				backButton.hide();
			}
		} catch (_e) {}
	});

	const handleBan = async () => {
		const targetId = memberIdInput().trim();
		if (!targetId) {
			showToast('Please enter a valid Telegram User ID', 'error');
			return;
		}
		if (!confirm(`Are you sure you want to ban Telegram User ${targetId} from the channel?`)) {
			return;
		}
		setIsBanning(true);
		haptic.notify('warning');

		try {
			await channelApi.banMember(params.id, targetId);
			haptic.notify('success');
			showToast(`User ${targetId} has been banned from the channel.`, 'success');
			setMemberIdInput('');
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || 'Failed to ban user', 'error');
		} finally {
			setIsBanning(false);
		}
	};

	const handleRestrict = async () => {
		const targetId = memberIdInput().trim();
		if (!targetId) {
			showToast('Please enter a valid Telegram User ID', 'error');
			return;
		}
		setIsRestricting(true);
		haptic.impact('medium');

		try {
			await channelApi.restrictMember(params.id, targetId);
			haptic.notify('success');
			showToast(`User ${targetId} permissions restricted in channel.`, 'success');
			setMemberIdInput('');
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || 'Failed to restrict user', 'error');
		} finally {
			setIsRestricting(false);
		}
	};

	return (
		<div
			class="min-h-screen bg-neutral-950 text-neutral-100 pb-28 pt-2 px-4"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			<ChannelContextBar channelId={params.id} />
			<ChannelHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				channelId={params.id}
				activeTab="members"
			/>

			{/* Header */}
			<div class="mt-4 mb-5 flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
						<span>👥</span>
						<span>{t('channel.members.title') || 'Channel Members & Moderation'}</span>
					</h1>
					<p class="text-xs text-neutral-400 mt-1">
						{t('channel.members.subtitle') ||
							'Search, moderate, and enforce user access control on your channel.'}
					</p>
				</div>
			</div>

			{/* Channel Subscribers Card */}
			<div class="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3 mb-5 shadow-lg">
				<div class="flex items-center justify-between">
					<div class="text-xs text-neutral-400">{t('channelMembers.totalSubscribers')}</div>
					<div class="text-lg font-bold text-white">
						{channelInfo()?.subscribers_count?.toLocaleString() || '0'}
					</div>
				</div>

				<div class="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 text-[11px] text-neutral-400 leading-relaxed">
					ℹ️ Telegram Bot API privacy policies restrict bots from downloading full membership rosters
					of large channels without active interaction. You can execute direct moderation actions
					below using user Telegram IDs.
				</div>
			</div>

			{/* Direct Moderation Action Box */}
			<div class="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
				<h3 class="text-sm font-bold text-white flex items-center gap-2">
					<span>🛡️</span>
					<span>{t('channel.members.action_box') || 'Direct User Moderation'}</span>
				</h3>

				<div class="space-y-2">
					<div class="text-xs font-semibold text-neutral-300">{t('channelMembers.targetUserId')}</div>
					<input
						type="number"
						value={memberIdInput()}
						onInput={(e) => setMemberIdInput(e.currentTarget.value)}
						placeholder="e.g. 123456789"
						class="w-full py-2.5 px-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs focus:border-[#0098EA] focus:outline-none"
					/>
				</div>

				<div class="grid grid-cols-2 gap-2.5 pt-1">
					<button
						type="button"
						onClick={handleRestrict}
						disabled={isRestricting() || !memberIdInput().trim()}
						class="py-2.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 active:scale-[0.98] transition-all disabled:opacity-40"
					>
						<span>{t('channelMembers.restrictUser')}</span>
					</button>

					<button
						type="button"
						onClick={handleBan}
						disabled={isBanning() || !memberIdInput().trim()}
						class="py-2.5 px-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 active:scale-[0.98] transition-all disabled:opacity-40"
					>
						<span>{t('channelMembers.banUser')}</span>
					</button>
				</div>
			</div>
		</div>
	);
};
