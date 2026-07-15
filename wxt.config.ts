import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

export default defineConfig({
  browser: 'chrome',
  vite: () => ({ plugins: [react()] }),
  manifest: {
    name: 'WebMCP Tool Inference',
    description: 'AI-powered WebMCP tool inference for any web page',
    version: '0.1.0',
    permissions: ['activeTab', 'storage', 'scripting', 'webNavigation', 'nativeMessaging'],
    host_permissions: ['<all_urls>'],
    action: {
      default_popup: 'popup.html',
      default_icon: {
        '16': 'icon-16.png',
        '32': 'icon-32.png',
        '48': 'icon-48.png',
        '128': 'icon-128.png',
      },
    },
    icons: {
      '16': 'icon-16.png',
      '32': 'icon-32.png',
      '48': 'icon-48.png',
      '128': 'icon-128.png',
    },
  },
});
