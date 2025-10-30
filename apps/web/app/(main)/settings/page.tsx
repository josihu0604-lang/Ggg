import { Metadata } from 'next';
import SettingToggle from '../../../components/settings/SettingToggle';

export const metadata: Metadata = {
  title: 'Settings - ZZIK',
  description: 'Manage your account settings',
};

export default function SettingsPage() {
  return (
    <main className="h-[100dvh] overflow-y-auto pb-safe">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <span aria-hidden="true">⚙️</span>
          <span>Settings</span>
        </h1>
        
        {/* Account Settings */}
        <section className="mb-6 glass-card p-4 rounded-2xl animate-liquid-appear">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span aria-hidden="true">👤</span>
            <span>Account</span>
          </h2>
          <div className="space-y-2">
            <button className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between group">
              <span className="flex items-center gap-3">
                <span className="text-lg" aria-hidden="true">✏️</span>
                <span className="text-sm font-medium">Edit Profile</span>
              </span>
              <span className="text-gray-400 group-hover:text-gray-300 transition-colors" aria-hidden="true">›</span>
            </button>
            <button className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between group">
              <span className="flex items-center gap-3">
                <span className="text-lg" aria-hidden="true">🔒</span>
                <span className="text-sm font-medium">Privacy Settings</span>
              </span>
              <span className="text-gray-400 group-hover:text-gray-300 transition-colors" aria-hidden="true">›</span>
            </button>
          </div>
        </section>

        {/* Notifications */}
        <section className="mb-6 glass-card p-4 rounded-2xl animate-liquid-appear">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span aria-hidden="true">🔔</span>
            <span>Notifications</span>
          </h2>
          <div className="space-y-2">
            <SettingToggle
              icon="📢"
              label="Push Notifications"
              description="Receive notifications for new offers and rewards"
              defaultValue={true}
            />
            <SettingToggle
              icon="📍"
              label="Location Alerts"
              description="Get notified when near saved locations"
              defaultValue={true}
            />
            <SettingToggle
              icon="🔥"
              label="Streak Reminders"
              description="Daily reminder to maintain your streak"
              defaultValue={true}
            />
          </div>
        </section>

        {/* App Settings */}
        <section className="mb-6 glass-card p-4 rounded-2xl animate-liquid-appear">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span aria-hidden="true">🎨</span>
            <span>App Settings</span>
          </h2>
          <div className="space-y-2">
            <SettingToggle
              icon="🌙"
              label="Dark Mode"
              description="Always use dark theme"
              defaultValue={true}
            />
            <SettingToggle
              icon="🔋"
              label="Battery Saver"
              description="Reduce animations and background activity"
              defaultValue={false}
            />
            <button className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between group">
              <span className="flex items-center gap-3">
                <span className="text-lg" aria-hidden="true">🌐</span>
                <span className="text-sm font-medium">Language</span>
              </span>
              <span className="text-gray-400 text-sm group-hover:text-gray-300 transition-colors">한국어</span>
            </button>
            <button className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between group">
              <span className="flex items-center gap-3">
                <span className="text-lg" aria-hidden="true">💾</span>
                <span className="text-sm font-medium">Data & Storage</span>
              </span>
              <span className="text-gray-400 group-hover:text-gray-300 transition-colors" aria-hidden="true">›</span>
            </button>
          </div>
        </section>

        {/* About */}
        <section className="glass-card p-4 rounded-2xl mb-4 animate-liquid-appear">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span aria-hidden="true">ℹ️</span>
            <span>About</span>
          </h2>
          <div className="space-y-2">
            <button className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between group">
              <span className="flex items-center gap-3">
                <span className="text-lg" aria-hidden="true">❓</span>
                <span className="text-sm font-medium">Help & Support</span>
              </span>
              <span className="text-gray-400 group-hover:text-gray-300 transition-colors" aria-hidden="true">›</span>
            </button>
            <button className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between group">
              <span className="flex items-center gap-3">
                <span className="text-lg" aria-hidden="true">📜</span>
                <span className="text-sm font-medium">Terms of Service</span>
              </span>
              <span className="text-gray-400 group-hover:text-gray-300 transition-colors" aria-hidden="true">›</span>
            </button>
            <button className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between group">
              <span className="flex items-center gap-3">
                <span className="text-lg" aria-hidden="true">🔐</span>
                <span className="text-sm font-medium">Privacy Policy</span>
              </span>
              <span className="text-gray-400 group-hover:text-gray-300 transition-colors" aria-hidden="true">›</span>
            </button>
            <div className="p-3 text-sm text-gray-400 flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">📱</span>
              <span>Version 2.0.0-beta</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
