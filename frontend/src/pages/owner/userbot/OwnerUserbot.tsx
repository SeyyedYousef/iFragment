import { createSignal, createEffect, onCleanup, Show, For, type Component } from 'solid-js';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { ownerApi } from '../../../entities/owner/api/ownerApi';
import type { ManagedUserbot } from '../../../entities/owner/model/types';
import { DangerActionDialog } from '../../../widgets/owner/DangerActionDialog';

export const OwnerUserbot: Component = () => {
	const queryClient = useQueryClient();

	const [isConnecting, setIsConnecting] = createSignal(false);
	const [phone, setPhone] = createSignal('');
	const [code, setCode] = createSignal('');
	const [phoneCodeHash, setPhoneCodeHash] = createSignal('');
	const [step, setStep] = createSignal<'phone' | 'code'>('phone');
	const [countdown, setCountdown] = createSignal(0);

	const [userbotToDelete, setUserbotToDelete] = createSignal<ManagedUserbot | null>(null);

	let timer: any;
	onCleanup(() => clearInterval(timer));

	const userbotsQuery = createQuery(() => ({
		queryKey: ['owner', 'userbots'],
		queryFn: ownerApi.listUserbots,
	}));

	const sendCodeMutation = createMutation(() => ({
		mutationFn: (phoneNumber: string) => ownerApi.sendUserbotCode(phoneNumber),
		onSuccess: (data) => {
			setPhoneCodeHash(data.phone_code_hash);
			setStep('code');
			startCountdown();
		},
	}));

	const verifyCodeMutation = createMutation(() => ({
		mutationFn: () =>
			ownerApi.verifyUserbotCode(phone().trim(), code().trim(), phoneCodeHash()),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'userbots'] });
			resetConnectModal();
		},
	}));

	const deleteMutation = createMutation(() => ({
		mutationFn: (id: string) => ownerApi.deleteUserbot(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'userbots'] });
			setUserbotToDelete(null);
		},
	}));

	const startCountdown = () => {
		setCountdown(60);
		clearInterval(timer);
		timer = setInterval(() => {
			setCountdown((c) => {
				if (c <= 1) {
					clearInterval(timer);
					return 0;
				}
				return c - 1;
			});
		}, 1000);
	};

	const resetConnectModal = () => {
		setIsConnecting(false);
		setPhone('');
		setCode('');
		setPhoneCodeHash('');
		setStep('phone');
		clearInterval(timer);
	};

	const maskPhoneNumber = (raw: string) => {
		if (!raw || raw.length < 7) return raw;
		const clean = raw.replace(/\s+/g, '');
		return `${clean.slice(0, 4)} *** **${clean.slice(-2)}`;
	};

	const userbots = () => userbotsQuery.data || [];

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div>
					<h2 class="text-lg font-bold text-white">MTProto Userbot Farm</h2>
					<p class="text-xs text-white/50">Manage dedicated MTProto worker sessions for channel and group automation</p>
				</div>
				<button
					onClick={() => {
						resetConnectModal();
						setIsConnecting(true);
					}}
					class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-lg shadow-amber-500/20"
				>
					<span class="material-symbols-rounded text-base">phonelink_setup</span>
					<span>Connect New Userbot</span>
				</button>
			</div>

			{/* Connect Modal */}
			<Show when={isConnecting()}>
				<div class="rounded-3xl border border-amber-500/30 bg-black/70 p-6 space-y-4 backdrop-blur-xl max-w-md mx-auto">
					<div class="flex items-center justify-between border-b border-white/10 pb-3">
						<h3 class="text-sm font-bold text-white">
							{step() === 'phone' ? 'Step 1: Enter Phone Number' : 'Step 2: Enter Telegram Auth Code'}
						</h3>
						<button onClick={resetConnectModal} class="text-xs text-white/50 hover:text-white">
							Cancel
						</button>
					</div>

					<Show when={step() === 'phone'}>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								if (phone().trim()) sendCodeMutation.mutate(phone().trim());
							}}
							class="space-y-3"
						>
							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									Phone Number (with Country Code)
								</label>
								<input
									type="tel"
									placeholder="+1234567890"
									value={phone()}
									onInput={(e) => setPhone(e.currentTarget.value)}
									class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
									required
								/>
							</div>

							<button
								type="submit"
								disabled={sendCodeMutation.isPending || !phone().trim()}
								class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition disabled:opacity-50"
							>
								{sendCodeMutation.isPending ? 'Requesting Code...' : 'Send Login Code'}
							</button>
						</form>
					</Show>

					<Show when={step() === 'code'}>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								if (code().trim()) verifyCodeMutation.mutate();
							}}
							class="space-y-3"
						>
							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									5-Digit Telegram Verification Code
								</label>
								<input
									type="text"
									inputMode="numeric"
									placeholder="12345"
									value={code()}
									onInput={(e) => setCode(e.currentTarget.value)}
									class="w-full h-11 text-center tracking-[0.5em] font-mono text-lg rounded-xl bg-white/5 border border-white/15 text-white focus:border-amber-400 focus:outline-none"
									required
								/>
							</div>

							<div class="flex items-center justify-between text-xs text-white/50">
								<span>Sent to {maskPhoneNumber(phone())}</span>
								<Show
									when={countdown() > 0}
									fallback={
										<button
											type="button"
											onClick={() => sendCodeMutation.mutate(phone().trim())}
											class="text-amber-400 hover:underline"
										>
											Resend Code
										</button>
									}
								>
									<span>Resend in {countdown()}s</span>
								</Show>
							</div>

							<button
								type="submit"
								disabled={verifyCodeMutation.isPending || !code().trim()}
								class="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition disabled:opacity-50"
							>
								{verifyCodeMutation.isPending ? 'Verifying...' : 'Authenticate & Save Session'}
							</button>
						</form>
					</Show>
				</div>
			</Show>

			{/* Userbots Table */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-white/10 text-white/40">
								<th class="pb-3">Session ID</th>
								<th class="pb-3">Masked Phone</th>
								<th class="pb-3">Channels Managed</th>
								<th class="pb-3">Status</th>
								<th class="pb-3">Connected Since</th>
								<th class="pb-3 text-right">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							<Show
								when={!userbotsQuery.isLoading && userbots().length > 0}
								fallback={
									<tr>
										<td colspan="6" class="py-8 text-center text-white/40">
											{userbotsQuery.isLoading ? 'Loading userbots...' : 'No userbots connected'}
										</td>
									</tr>
								}
							>
								<For each={userbots()}>
									{(bot) => (
										<tr class="hover:bg-white/[0.02] transition">
											<td class="py-3 font-mono text-white/70">{bot.id.slice(0, 8)}...</td>
											<td class="py-3 font-mono font-bold text-amber-400">
												{maskPhoneNumber(bot.phone_number)}
											</td>
											<td class="py-3 font-mono text-white/80">{bot.channels_count} channels</td>
											<td class="py-3">
												<span
													class={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
														bot.status === 'active' || bot.status === 'connected'
															? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
															: 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
													}`}
												>
													{bot.status}
												</span>
											</td>
											<td class="py-3 text-white/50">{new Date(bot.created_at).toLocaleDateString()}</td>
											<td class="py-3 text-right">
												<button
													onClick={() => setUserbotToDelete(bot)}
													class="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"
													title="Log Out & Delete Userbot"
												>
													<span class="material-symbols-rounded text-base">logout</span>
												</button>
											</td>
										</tr>
									)}
								</For>
							</Show>
						</tbody>
					</table>
				</div>
			</div>

			{/* Logout Confirmation */}
			<Show when={userbotToDelete()}>
				<DangerActionDialog
					isOpen={true}
					title="Revoke & Delete MTProto Userbot"
					description={`Terminate MTProto session for ${maskPhoneNumber(userbotToDelete()?.phone_number || '')}? This will log out on Telegram and delete the session file.`}
					actionLabel="Revoke & Delete"
					confirmWord="DELETE"
					riskLevel="critical"
					requireReason={false}
					loading={deleteMutation.isPending}
					onConfirm={() => {
						if (userbotToDelete()) {
							deleteMutation.mutate(userbotToDelete()!.id);
						}
					}}
					onClose={() => setUserbotToDelete(null)}
				/>
			</Show>
		</div>
	);
};
