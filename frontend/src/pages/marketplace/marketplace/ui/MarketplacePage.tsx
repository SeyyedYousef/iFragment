import { Component, createSignal, createResource, onMount, onCleanup, For, Show } from 'solid-js';
// import { useNavigate } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t } from '@/shared/i18n/index.js';
import { marketplaceApi, frgApi } from '@/shared/api/bot-management.js';
import type { PurchaseOption, FRGTransaction } from '@/shared/api/bot-management.js';
import { openInvoice } from '@/shared/lib/telegram-native.js';

export const MarketplacePage: Component = () => {
  // const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal<'buy' | 'convert' | 'history'>('buy');
  const [activeMethod, setActiveMethod] = createSignal<'stars' | 'toncoin'>('stars');
  const [convertAmount, setConvertAmount] = createSignal('');
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [successMsg, setSuccessMsg] = createSignal('');
  const [errorMsg, setErrorMsg] = createSignal('');

  const [selectedOptionForTon, setSelectedOptionForTon] = createSignal<PurchaseOption | null>(null);
  const [txHash, setTxHash] = createSignal('');
  const [copiedAddress, setCopiedAddress] = createSignal(false);
  const [copiedComment, setCopiedComment] = createSignal(false);

  const [balance, { refetch: refetchBalance }] = createResource(frgApi.getBalance);
  const [options] = createResource(marketplaceApi.getOptions);
  const [transactions, { refetch: refetchTransactions }] = createResource(() => frgApi.getTransactions(20, 0));

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => window.history.back());
    onCleanup(() => off());
  });

  const filteredOptions = () =>
    (options() || []).filter((o: PurchaseOption) => o.method === activeMethod());

  const convertedFRG = () => {
    const coins = parseFloat(convertAmount() || '0');
    return coins >= 100 ? Math.floor(coins / 100 * 10000) / 10000 : 0;
  };

  const tonLink = () => {
    const option = selectedOptionForTon();
    if (!option) return '#';
    const recipient = 'EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi';
    const nanotons = Math.round(option.price * 1_000_000_000);
    const text = `FRG_${option.id}`;
    return `ton://transfer/${recipient}?amount=${nanotons}&text=${encodeURIComponent(text)}`;
  };

  const handlePurchase = async (option: PurchaseOption) => {
    setIsProcessing(true);
    setErrorMsg('');
    try {
      if (option.method === 'stars') {
        const hasOpenInvoice = typeof (window as any).Telegram?.WebApp?.openInvoice === 'function';
        if (hasOpenInvoice) {
          const mockInvoiceLink = `https://t.me/$mock_invoice_for_stars_${option.id}`;
          const status = await openInvoice(mockInvoiceLink);
          if (status === 'paid') {
            const chargeId = `tg_charge_${Math.random().toString(36).substring(2, 15)}`;
            await marketplaceApi.purchaseWithStars(option.id, chargeId);
            hapticFeedback.notificationOccurred('success');
            setSuccessMsg(`${option.frg_amount} FRG credited successfully!`);
            refetchBalance();
            refetchTransactions();
          } else {
            setErrorMsg('Payment not completed.');
            hapticFeedback.notificationOccurred('error');
          }
        } else {
          // Fallback to demo flow
          await marketplaceApi.purchaseWithStars(option.id, `demo_charge_${Date.now()}`);
          hapticFeedback.notificationOccurred('success');
          setSuccessMsg(`${option.frg_amount} FRG credited!`);
          refetchBalance();
          refetchTransactions();
        }
      } else {
        hapticFeedback.notificationOccurred('warning');
        setSuccessMsg('Toncoin payment: Send to the displayed wallet address. FRG will be credited after confirmation.');
      }
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.error || 'Payment failed. Please try again.');
      hapticFeedback.notificationOccurred('error');
    } finally {
      setIsProcessing(false);
      setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 4000);
    }
  };

  const handleVerifyToncoin = async () => {
    const option = selectedOptionForTon();
    const hash = txHash().trim();
    if (!option) return;
    if (!hash) {
      setErrorMsg('Please enter your transaction hash.');
      return;
    }
    
    setIsProcessing(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      await marketplaceApi.purchaseWithToncoin(option.id, hash);
      hapticFeedback.notificationOccurred('success');
      setSuccessMsg(`Payment verified! ${option.frg_amount} FRG credited successfully!`);
      setTxHash('');
      setSelectedOptionForTon(null);
      refetchBalance();
      refetchTransactions();
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.error || 'Verification failed. Please check the hash or try again.');
      hapticFeedback.notificationOccurred('error');
    } finally {
      setIsProcessing(false);
      setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 5000);
    }
  };

  const handleConvert = async () => {
    const coins = parseFloat(convertAmount());
    if (coins < 100) {
      setErrorMsg('Minimum 100 coins required (= 1 FRG)');
      return;
    }
    setIsProcessing(true);
    setErrorMsg('');
    try {
      await marketplaceApi.convertAirdropCoins(coins);
      hapticFeedback.notificationOccurred('success');
      setSuccessMsg(`${convertedFRG()} FRG credited from ${coins} coins!`);
      setConvertAmount('');
      refetchBalance();
      refetchTransactions();
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.error || 'Conversion failed.');
      hapticFeedback.notificationOccurred('error');
    } finally {
      setIsProcessing(false);
      setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 4000);
    }
  };

  const txTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      purchase_stars: '⭐ Stars Purchase',
      purchase_toncoin: '💎 Toncoin Purchase',
      airdrop_convert: '🪂 Airdrop Conversion',
      subscription_payment: '📦 Subscription',
      refund: '↩️ Refund',
      admin_credit: '🛡️ Admin Credit',
    };
    return map[type] || type;
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-24 relative text-white">
      {/* Header */}
      <div class="px-5 pt-6 pb-4 sticky top-0 bg-[#0f1014]/90 backdrop-blur-md z-30 border-b border-[#1c1c1c]">
        <div class="flex items-center justify-between">
          <div class="flex flex-col gap-1">
            <h1 class="text-2xl font-black text-white">{t('marketplace.title')}</h1>
            <p class="text-[13px] font-medium text-[#8e8e93] leading-snug">
              {t('marketplace.subtitle')}
            </p>
          </div>
        </div>

        {/* Balance Card */}
        <Motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          class="mt-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-3xl border border-[#2a2a4a] p-5 relative overflow-hidden"
        >
          <div class="absolute top-0 right-0 w-32 h-32 bg-[#3390ec]/5 rounded-full blur-3xl" />
          <div class="relative z-10">
            <p class="text-[12px] font-bold text-[#8e8e93] uppercase tracking-wider">Your FRG Balance</p>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-4xl font-black text-white">
                {balance.loading ? '...' : (balance()?.balance ?? 0).toFixed(2)}
              </span>
              <span class="text-[16px] font-bold text-[#3390ec]">FRG</span>
            </div>
            <p class="text-[12px] text-[#8e8e93] mt-1">
              ≈ ${balance.loading ? '...' : (balance()?.balance ?? 0).toFixed(2)} USD
            </p>
          </div>
        </Motion.div>

        {/* Tabs */}
        <div class="flex gap-2 mt-4 pb-1">
          {[
            { id: 'buy' as const, icon: 'shopping_cart', label: 'Buy FRG' },
            { id: 'convert' as const, icon: 'sync_alt', label: 'Convert' },
            { id: 'history' as const, icon: 'receipt_long', label: 'History' },
          ].map(tab => (
            <button
              onClick={() => { hapticFeedback.selectionChanged(); setActiveTab(tab.id); }}
              class={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl whitespace-nowrap transition-all border ${
                activeTab() === tab.id
                  ? 'bg-[#3390ec]/10 border-[#3390ec]/30 text-[#3390ec]'
                  : 'bg-[#1c1c1c] border-[#2a2a2a] text-[#8e8e93] hover:bg-[#2a2a2a]'
              }`}
            >
              <span class="material-symbols-outlined text-[18px]">{tab.icon}</span>
              <span class="text-[13px] font-bold">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Status Messages */}
      <Show when={successMsg()}>
        <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          class="mx-5 mt-4 bg-[#34c759]/10 border border-[#34c759]/30 text-[#34c759] rounded-2xl px-4 py-3 flex items-center gap-2 text-[13px] font-bold">
          <span class="material-symbols-outlined text-[18px]">check_circle</span>
          {successMsg()}
        </Motion.div>
      </Show>
      <Show when={errorMsg()}>
        <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          class="mx-5 mt-4 bg-[#ff3b30]/10 border border-[#ff3b30]/30 text-[#ff3b30] rounded-2xl px-4 py-3 flex items-center gap-2 text-[13px] font-bold">
          <span class="material-symbols-outlined text-[18px]">error</span>
          {errorMsg()}
        </Motion.div>
      </Show>

      <div class="px-5 mt-4 space-y-4">
        {/* Buy Tab */}
        <Show when={activeTab() === 'buy'}>
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} class="space-y-4">
            {/* Method Toggle */}
            <Show when={!selectedOptionForTon() || activeMethod() !== 'toncoin'}>
              <div class="bg-[#1c1c1c] rounded-2xl border border-[#2a2a2a] p-1 flex gap-1">
                <button
                  onClick={() => { hapticFeedback.selectionChanged(); setActiveMethod('stars'); setSelectedOptionForTon(null); setTxHash(''); }}
                  class={`flex-1 py-3 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all ${
                    activeMethod() === 'stars' ? 'bg-[#3390ec] text-white' : 'text-[#8e8e93] hover:text-white'
                  }`}
                >
                  ⭐ Telegram Stars
                </button>
                <button
                  onClick={() => { hapticFeedback.selectionChanged(); setActiveMethod('toncoin'); }}
                  class={`flex-1 py-3 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all ${
                    activeMethod() === 'toncoin' ? 'bg-[#3390ec] text-white' : 'text-[#8e8e93] hover:text-white'
                  }`}
                >
                  💎 Toncoin
                </button>
              </div>
            </Show>

            {/* Purchase Options / Checkout Panel */}
            <Show when={activeMethod() === 'toncoin' && selectedOptionForTon()} fallback={
              <For each={filteredOptions()}>
                {(option: PurchaseOption) => (
                  <Motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    class={`bg-[#1c1c1c] rounded-3xl border p-4 flex items-center justify-between relative overflow-hidden transition-all hover:bg-[#222] ${
                      option.popular ? 'border-[#3390ec]/40' : 'border-[#2a2a2a]'
                    }`}
                  >
                    <Show when={option.popular}>
                      <div class="absolute top-0 right-0 bg-[#3390ec] text-white text-[10px] font-black px-3 py-0.5 rounded-bl-xl">
                        POPULAR
                      </div>
                    </Show>
                    <div class="flex flex-col gap-0.5">
                      <div class="flex items-baseline gap-1.5">
                        <span class="text-[22px] font-black text-white">{option.frg_amount}</span>
                        <span class="text-[14px] font-bold text-[#3390ec]">FRG</span>
                      </div>
                      <Show when={option.discount}>
                        <span class="text-[11px] font-bold text-[#34c759] bg-[#34c759]/10 px-2 py-0.5 rounded-full w-fit">
                          Save {option.discount}
                        </span>
                      </Show>
                    </div>
                    <button
                      onClick={() => {
                        hapticFeedback.selectionChanged();
                        if (option.method === 'toncoin') {
                          setSelectedOptionForTon(option);
                        } else {
                          handlePurchase(option);
                        }
                      }}
                      disabled={isProcessing()}
                      class="bg-[#3390ec] hover:bg-[#2b7bc9] text-white font-bold text-[14px] px-5 py-3 rounded-2xl transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-[0_4px_15px_rgba(51,144,236,0.2)]"
                    >
                      <Show when={!isProcessing()} fallback={<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
                        {option.price} {option.currency === 'XTR' ? '⭐' : 'TON'}
                      </Show>
                    </button>
                  </Motion.div>
                )}
              </For>
            }>
              {/* Checkout Panel for selected Toncoin option */}
              <Motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-6 space-y-6"
              >
                {/* Back Button */}
                <button
                  onClick={() => { hapticFeedback.selectionChanged(); setSelectedOptionForTon(null); setTxHash(''); }}
                  class="flex items-center gap-2 text-[13px] font-bold text-[#8e8e93] hover:text-white transition-colors"
                >
                  <span class="material-symbols-outlined text-[18px]">arrow_back</span>
                  Back to packages
                </button>

                {/* Package Info */}
                <div class="bg-[#141518] rounded-2xl border border-[#2a2a2a] p-4 flex items-center justify-between">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-[12px] font-bold text-[#8e8e93]">Selected Package</span>
                    <span class="text-[18px] font-black text-white">{selectedOptionForTon()?.frg_amount} FRG</span>
                  </div>
                  <div class="text-right">
                    <span class="text-[12px] font-bold text-[#8e8e93]">Amount to Send</span>
                    <p class="text-[18px] font-black text-[#3390ec]">{selectedOptionForTon()?.price} TON</p>
                  </div>
                </div>

                {/* Steps */}
                <div class="space-y-5">
                  {/* Step 1: Send payment */}
                  <div class="space-y-3">
                    <div class="flex items-center gap-2">
                      <span class="w-6 h-6 rounded-full bg-[#3390ec]/10 border border-[#3390ec]/30 flex items-center justify-center text-[12px] font-bold text-[#3390ec]">1</span>
                      <h4 class="text-[14px] font-bold text-white">Transfer Toncoin</h4>
                    </div>
                    
                    <div class="space-y-3 pl-8">
                      {/* Wallet Address */}
                      <div class="space-y-1.5">
                        <span class="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider block">Recipient Wallet Address</span>
                        <div class="flex items-center gap-2">
                          <div class="flex-1 font-mono text-[12px] bg-[#141518] px-3.5 py-3 rounded-xl border border-[#2a2a2a] break-all select-all font-medium text-white leading-normal">
                            EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi
                          </div>
                          <button
                            onClick={() => {
                              if (navigator.clipboard) {
                                navigator.clipboard.writeText('EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi');
                              } else {
                                const el = document.createElement('textarea');
                                el.value = 'EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi';
                                document.body.appendChild(el);
                                el.select();
                                document.execCommand('copy');
                                document.body.removeChild(el);
                              }
                              hapticFeedback.impactOccurred('heavy');
                              setCopiedAddress(true);
                              setTimeout(() => setCopiedAddress(false), 2000);
                            }}
                            class={`h-[42px] w-[42px] shrink-0 border rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                              copiedAddress()
                                ? 'bg-[#34c759]/10 border-[#34c759]/30 text-[#34c759]'
                                : 'bg-[#3390ec]/10 border-[#3390ec]/30 text-[#3390ec] hover:bg-[#3390ec]/20'
                            }`}
                          >
                            <span class="material-symbols-outlined text-[18px]">
                              {copiedAddress() ? 'done' : 'content_copy'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Comment / Memo */}
                      <div class="space-y-1.5">
                        <span class="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider block">Required Comment (Message)</span>
                        <div class="flex items-center gap-2">
                          <div class="flex-1 font-mono text-[13px] bg-[#141518] px-3.5 py-3 rounded-xl border border-[#2a2a2a] select-all font-bold text-[#ff9500] leading-normal">
                            FRG_{selectedOptionForTon()?.id}
                          </div>
                          <button
                            onClick={() => {
                              const text = `FRG_${selectedOptionForTon()?.id}`;
                              if (navigator.clipboard) {
                                navigator.clipboard.writeText(text);
                              } else {
                                const el = document.createElement('textarea');
                                el.value = text;
                                document.body.appendChild(el);
                                el.select();
                                document.execCommand('copy');
                                document.body.removeChild(el);
                              }
                              hapticFeedback.impactOccurred('heavy');
                              setCopiedComment(true);
                              setTimeout(() => setCopiedComment(false), 2000);
                            }}
                            class={`h-[42px] w-[42px] shrink-0 border rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                              copiedComment()
                                ? 'bg-[#34c759]/10 border-[#34c759]/30 text-[#34c759]'
                                : 'bg-[#3390ec]/10 border-[#3390ec]/30 text-[#3390ec] hover:bg-[#3390ec]/20'
                            }`}
                          >
                            <span class="material-symbols-outlined text-[18px]">
                              {copiedComment() ? 'done' : 'content_copy'}
                            </span>
                          </button>
                        </div>
                        <p class="text-[11px] text-[#ff9500] font-semibold leading-snug">
                          ⚠️ IMPORTANT: You must include this comment exact as shown! Otherwise your payment cannot be verified.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Open TON Wallet */}
                  <div class="space-y-3">
                    <div class="flex items-center gap-2">
                      <span class="w-6 h-6 rounded-full bg-[#3390ec]/10 border border-[#3390ec]/30 flex items-center justify-center text-[12px] font-bold text-[#3390ec]">2</span>
                      <h4 class="text-[14px] font-bold text-white">Pay via Wallet App</h4>
                    </div>
                    
                    <div class="pl-8">
                      <a
                        href={tonLink()}
                        onClick={() => hapticFeedback.impactOccurred('heavy')}
                        class="w-full h-12 bg-[#3390ec] hover:bg-[#2b7bc9] text-white rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(51,144,236,0.25)] active:scale-95 duration-150"
                      >
                        <span class="material-symbols-outlined text-[18px]">rocket_launch</span>
                        Open TON Wallet
                      </a>
                    </div>
                  </div>

                  {/* Step 3: Paste transaction hash and verify */}
                  <div class="space-y-3">
                    <div class="flex items-center gap-2">
                      <span class="w-6 h-6 rounded-full bg-[#3390ec]/10 border border-[#3390ec]/30 flex items-center justify-center text-[12px] font-bold text-[#3390ec]">3</span>
                      <h4 class="text-[14px] font-bold text-white">Verify Payment</h4>
                    </div>
                    
                    <div class="pl-8 space-y-4">
                      <div class="flex flex-col gap-1.5">
                        <label for="checkout-tx-hash" class="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider block">Transaction Hash (tx_hash)</label>
                        <input
                          id="checkout-tx-hash"
                          type="text"
                          value={txHash()}
                          onInput={(e) => setTxHash(e.currentTarget.value)}
                          placeholder="Paste your transaction hash here..."
                          class="w-full bg-[#141518] text-white text-[13px] font-mono px-4 py-3 rounded-xl border border-[#2a2a2a] focus:outline-none focus:border-[#3390ec] placeholder:text-[#555] transition-all leading-normal"
                        />
                      </div>
                      
                      <button
                        onClick={handleVerifyToncoin}
                        disabled={isProcessing() || !txHash().trim()}
                        class="w-full h-12 bg-[#34c759] hover:bg-[#2eb14f] text-white rounded-xl font-bold text-[14px] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(52,199,89,0.15)] active:scale-95 duration-150"
                      >
                        <Show when={!isProcessing()} fallback={<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
                          <span class="material-symbols-outlined text-[18px]">verified</span>
                          Verify & Claim FRG
                        </Show>
                      </button>
                    </div>
                  </div>
                </div>
              </Motion.div>
            </Show>
          </Motion.div>
        </Show>

        {/* Convert Tab */}
        <Show when={activeTab() === 'convert'}>
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} class="space-y-4">
            <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-5 space-y-4">
              <div class="flex flex-col gap-1">
                <span class="text-[15px] font-bold text-white">🪂 Convert Airdrop Coins</span>
                <span class="text-[12px] text-[#8e8e93]">Convert your mined coins to FRG tokens. Rate: 1,000 coins = 1 FRG ($1)</span>
              </div>

              <div class="bg-[#2c2c2e] rounded-2xl p-4 flex items-center gap-3">
                <div class="flex-1">
                  <label for="coins-to-convert" class="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider">Coins to convert</label>
                  <input
                    id="coins-to-convert"
                    type="number"
                    value={convertAmount()}
                    onInput={(e) => setConvertAmount(e.currentTarget.value)}
                    placeholder="Enter amount (min. 100)"
                    min="100"
                    class="w-full bg-transparent text-white text-[20px] font-bold mt-1 focus:outline-none placeholder:text-[#555]"
                  />
                </div>
                <div class="text-right">
                  <span class="text-[11px] font-bold text-[#8e8e93]">You receive</span>
                  <p class="text-[20px] font-black text-[#3390ec]">{convertedFRG().toFixed(2)} FRG</p>
                </div>
              </div>

              <button
                onClick={handleConvert}
                disabled={isProcessing() || convertedFRG() === 0}
                class="w-full h-14 bg-[#3390ec] hover:bg-[#2b7bc9] text-white rounded-2xl font-bold text-[16px] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(51,144,236,0.3)]"
              >
                <Show when={!isProcessing()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
                  <span class="material-symbols-outlined text-[20px]">sync_alt</span>
                  Convert to FRG
                </Show>
              </button>
            </div>

            {/* Rate Info */}
            <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 space-y-2">
              <span class="text-[13px] font-bold text-[#8e8e93]">Exchange Rate</span>
              <div class="flex items-center justify-between">
                <span class="text-[14px] text-white font-medium">100 Coins</span>
                <span class="material-symbols-outlined text-[#8e8e93] text-[16px]">arrow_forward</span>
                <span class="text-[14px] text-[#3390ec] font-bold">1 FRG ($1.00)</span>
              </div>
            </div>
          </Motion.div>
        </Show>

        {/* History Tab */}
        <Show when={activeTab() === 'history'}>
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} class="space-y-3">
            <Show when={transactions.loading}>
              <div class="flex items-center justify-center py-12">
                <span class="w-6 h-6 border-2 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin" />
              </div>
            </Show>

            <Show when={!transactions.loading && (!transactions() || transactions()!.length === 0)}>
              <div class="flex flex-col items-center justify-center py-16 gap-3">
                <span class="material-symbols-outlined text-[48px] text-[#3a3a3a]">receipt_long</span>
                <p class="text-[14px] text-[#8e8e93] font-medium">No transactions yet</p>
              </div>
            </Show>

            <For each={transactions() || []}>
              {(tx: FRGTransaction) => (
                <div class="bg-[#1c1c1c] rounded-2xl border border-[#2a2a2a] p-4 flex items-center justify-between">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-[14px] font-bold text-white">{txTypeLabel(tx.type)}</span>
                    <span class="text-[12px] text-[#8e8e93]">
                      {new Date(tx.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span class={`text-[16px] font-black ${tx.amount > 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} FRG
                  </span>
                </div>
              )}
            </For>
          </Motion.div>
        </Show>
      </div>

      {/* Premium Web3 Glassmorphic Block Verification Overlay */}
      <Show when={isProcessing()}>
        <div class="fixed inset-0 bg-black/85 backdrop-blur-md z-[999] flex flex-col items-center justify-center p-6 text-center">
          <div class="relative w-24 h-24 mb-6">
            <div class="absolute inset-0 rounded-full bg-gradient-to-tr from-[#3390ec] to-[#34c759] animate-spin blur-md opacity-45" />
            <div class="absolute inset-2 bg-[#0f1014] rounded-full flex items-center justify-center border border-white/10">
              <span class="material-symbols-outlined text-4xl text-[#3390ec] animate-pulse">account_balance_wallet</span>
            </div>
          </div>
          <h3 class="text-lg font-black text-white mb-2">Verifying Blockchain Settlement</h3>
          <p class="text-[13px] text-[#8e8e93] max-w-xs leading-normal">
            Querying TON block data. This takes a few seconds as we confirm the token contract balance. Please do not close the app...
          </p>
          <div class="mt-6 flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
            <span class="w-2.5 h-2.5 bg-[#34c759] rounded-full animate-ping" />
            <span class="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider">Syncing blockchain</span>
          </div>
        </div>
      </Show>
    </div>
  );
};
