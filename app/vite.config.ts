import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from "path"
import { createHtmlPlugin } from 'vite-plugin-html' //@ts-ignore
import { createTranslationPlugin } from "./src/translator"

const backendTarget =
  process.env.VITE_DEV_PROXY_TARGET || "http://127.0.0.1:8094";

const directProxyOptions = {
  target: backendTarget,
  changeOrigin: true,
  ws: true,
};

const stubLobehubPeerDeps = {
  name: 'stub-lobehub-peer-deps',
  resolveId(id: string) {
    if (['antd', 'antd-style', '@lobehub/ui', 'react-layout-kit'].includes(id)) {
      return '\0stub:' + id;
    }
  },
  load(id: string) {
    if (!id.startsWith('\0stub:')) return;
    return `
      import React from 'react';
      const Noop = () => null;
      const NoopFC = ({ children }) => children ?? null;
      export const useTheme = () => ({});
      export const useThemeMode = () => ({});
      export const createStyles = () => () => ({ styles: {} });
      export const Tag = Noop;
      export const Icon = Noop;
      export const ActionIcon = Noop;
      export const CopyButton = Noop;
      export const Tooltip = NoopFC;
      export const Highlighter = Noop;
      export const StoryBook = Noop;
      export const useControls = () => ({});
      export const useCreateStore = () => ({});
      export const Flexbox = NoopFC;
      export const Center = NoopFC;
      export const Divider = Noop;
      export default {};
    `;
  }
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    stubLobehubPeerDeps,
    react(),
    createHtmlPlugin({
      minify: true,
    }),
    createTranslationPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      }
    }
  },
  build: {
    manifest: true,
    chunkSizeWarningLimit: 2048,
    rollupOptions: {
output: {
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        ws: true,
      },
      "/v1": {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
      "/conversation": directProxyOptions,
      "/info": directProxyOptions,
      "/broadcast": directProxyOptions,
      "/mask": directProxyOptions,
      "/record": directProxyOptions,
      "/auth": directProxyOptions,
      "/apikey": directProxyOptions,
      "/admin": directProxyOptions,
    }
  }
});
