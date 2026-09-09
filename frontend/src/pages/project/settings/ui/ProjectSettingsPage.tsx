import { Component, createSignal, onMount, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { ProjectContextBar } from '@/widgets/project/index.js';
import { channelApi } from '@/entities/channel/api/channelApi.js';
import type { Project } from '@/entities/channel/model/types.js';

export const ProjectSettingsPage: Component = () => {
  const params = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = createSignal<Project | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [name, setName] = createSignal('');
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const res = await channelApi.getProject(params.projectId);
      setProject(res);
      setName(res.name);
    } catch (err: any) {
      setError(err.message || 'خطا در بارگذاری تنظیمات پروژه');
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchProject();
  });

  const handleUpdate = async () => {
    if (!name().trim()) return;
    try {
      setSaving(true);
      const updated = await channelApi.updateProject(params.projectId, { name: name().trim() });
      setProject(updated);
      alert('تنظیمات پروژه با موفقیت ذخیره شد.');
    } catch (err: any) {
      alert('خطا در به‌روزرسانی پروژه: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    const p = project();
    if (!p) return;
    try {
      setSaving(true);
      if (p.status === 'active') {
        await channelApi.pauseProject(p.id);
      } else {
        await channelApi.resumeProject(p.id);
      }
      await fetchProject();
    } catch (err: any) {
      alert('خطا در تغییر وضعیت پروژه: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setSaving(true);
      await channelApi.deleteProject(params.projectId);
      alert('پروژه با موفقیت بایگانی/حذف شد.');
      navigate('/projects');
    } catch (err: any) {
      alert('خطا در حذف پروژه: ' + err.message);
    } finally {
      setSaving(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div class="min-h-screen bg-[#0d1117] text-white p-4 max-w-4xl mx-auto" dir="rtl">
      <Show when={project()}>
        {(p) => <ProjectContextBar projectId={p().id} />}
      </Show>

      <Show when={loading()}>
        <div class="p-8 text-center text-gray-400">در حال دریافت تنظیمات پروژه...</div>
      </Show>

      <Show when={error()}>
        <div class="p-4 bg-red-900/40 border border-red-500 rounded-xl text-red-300 text-sm mb-4">
          {error()}
        </div>
      </Show>

      <Show when={!loading() && project()}>
        <div class="space-y-6">
          {/* General Settings */}
          <div class="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 class="text-base font-bold text-white flex items-center gap-2">
              <span>⚙️</span> تنظیمات عمومی پروژه
            </h2>

            <div>
              <label class="block text-xs text-gray-400 mb-1 font-medium">نام پروژه</label>
              <input
                type="text"
                class="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
              />
            </div>

            <div class="flex items-center justify-between pt-2">
              <div>
                <span class="text-xs text-gray-400">وضعیت اجرایی پایپ‌لاین:</span>
                <span class={`mr-2 text-xs font-bold px-2 py-0.5 rounded-full ${project()?.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {project()?.status === 'active' ? 'فعال (Running)' : 'متوقف (Paused)'}
                </span>
              </div>
              <button
                onClick={handleToggleStatus}
                disabled={saving()}
                class={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  project()?.status === 'active'
                    ? 'border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10'
                    : 'border-green-500/40 text-green-400 hover:bg-green-500/10'
                }`}
              >
                {project()?.status === 'active' ? 'توقف موقت پایپ‌لاین (Pause)' : 'فعال‌سازی پایپ‌لاین (Resume)'}
              </button>
            </div>

            <div class="pt-3 border-t border-gray-800 flex justify-end">
              <button
                onClick={handleUpdate}
                disabled={saving() || !name().trim()}
                class="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
              >
                {saving() ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
              </button>
            </div>
          </div>

          {/* Channels Mapping & Architecture Info */}
          <div class="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 class="text-base font-bold text-white flex items-center gap-2">
              <span>📡</span> کانال‌های متصل (Topological Binding)
            </h2>
            <p class="text-xs text-gray-400 leading-relaxed">
              کانال‌های ورودی و خروجی منابع اجرایی پروژه هستند. پروژه به صورت یک Aggregate Root بر آنها نظارت دارد و پست‌های دستی ادمین‌ها در کانال خروجی را به هیچ وجه لمس نمی‌کند.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div class="bg-[#0d1117] border border-gray-800 rounded-xl p-3.5 space-y-1">
                <span class="text-[11px] text-gray-500 font-medium">کانال ورودی (Source Ingestion)</span>
                <div class="text-sm font-semibold text-blue-400 flex items-center gap-1.5">
                  <span>📥</span>
                  <span>{project()?.source_channel_id || 'متصل'}</span>
                </div>
                <div class="text-[10px] text-gray-500 font-mono mt-1">ID: {project()?.source_channel_id}</div>
              </div>

              <div class="bg-[#0d1117] border border-gray-800 rounded-xl p-3.5 space-y-1">
                <span class="text-[11px] text-gray-500 font-medium">کانال خروجی (Passive Delivery Target)</span>
                <div class="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span>📤</span>
                  <span>{project()?.target_channel_id || 'متصل'}</span>
                </div>
                <div class="text-[10px] text-gray-500 font-mono mt-1">ID: {project()?.target_channel_id}</div>
              </div>
            </div>
          </div>

          {/* Subscription & Quota */}
          <div class="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-3">
            <h2 class="text-base font-bold text-white flex items-center gap-2">
              <span>💎</span> اشتراک و ظرفیت پروژه (Project-Level Subscription)
            </h2>
            <p class="text-xs text-gray-400">
              اشتراک بر اساس کل پروژه (یک ورودی + یک خروجی + صف تأیید + پایپ‌لاین کامل) محاسبه می‌شود، نه به صورت کانال‌های جداگانه.
            </p>
            <div class="p-3 bg-blue-950/30 border border-blue-800/40 rounded-xl flex items-center justify-between text-xs">
              <div class="text-blue-300">
                <div class="font-bold">پلن فعال: Pro Editorial Tier</div>
                <div class="text-blue-400/70 text-[11px]">شامل پایپ‌لاین هوش مصنوعی، صف نامحدود و انتشار محافظت‌شده</div>
              </div>
              <span class="bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full font-bold">
                فعال تا پایان دوره
              </span>
            </div>
          </div>

          {/* Danger Zone */}
          <div class="bg-[#161b22] border border-red-900/30 rounded-2xl p-5 space-y-3">
            <h2 class="text-base font-bold text-red-400 flex items-center gap-2">
              <span>⚠️</span> منطقه حساس (Danger Zone)
            </h2>
            <p class="text-xs text-gray-400 leading-relaxed">
              با حذف پروژه، پایپ‌لاین متوقف شده و پردازش‌ها لغو می‌گردند. کانال‌های تلگرامی دیسکانکت نمی‌شوند و تاریخچه انتشارها و لاگ‌های ممیزی جهت امنیت حفظ خواهند شد.
            </p>
            <div class="pt-2">
              <button
                onClick={() => setShowDeleteModal(true)}
                class="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition"
              >
                حذف یا غیرفعال‌سازی این پروژه
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Delete Confirmation Modal */}
      <Show when={showDeleteModal()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-[#161b22] border border-gray-800 rounded-2xl max-w-sm w-full p-6 text-right space-y-4 shadow-2xl">
            <h3 class="text-base font-bold text-white">آیا از حذف پروژه مطمئن هستید؟</h3>
            <p class="text-xs text-gray-400 leading-relaxed">
              این عملیات پروژه «{project()?.name}» را غیرفعال کرده و صف‌های در انتظار را پاکسازی می‌کند.
            </p>
            <div class="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition"
              >
                انصراف
              </button>
              <button
                onClick={handleDelete}
                disabled={saving()}
                class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
              >
                {saving() ? 'در حال حذف...' : 'تأیید و حذف'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};
