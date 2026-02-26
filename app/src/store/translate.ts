import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./index";
import { getMemory, setMemory } from "@/utils/memory.ts";


// --- 1. 状态接口定义 ---

export interface TranslationSetting {
  markdownPreview: boolean;
  autoCopy: boolean;
  syncScroll: boolean;
  detectMethod: "auto" | "algorithm" | "llm";
  bidirectional: boolean;
  systemPrompt: string;
}

export interface CustomLanguage {
  emoji: string;
  name: string;
  code: string;
}

export interface HistoryItem {
  id: string;
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  targetText: string;
  timestamp: number;
}

interface TranslateState {
  sourceText: string;
  targetText: string;
  sourceLang: string; // 'auto' 或 具体代码
  targetLang: string;
  model: string;
  isTranslating: boolean;
  
  settings: TranslationSetting;
  customLanguages: CustomLanguage[];
  history: HistoryItem[];
}

// --- 2. 初始状态 ---

const STORAGE_KEY = "translate_history";

const loadHistoryFromStorage = (): HistoryItem[] => {
  const data = getMemory(STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

const saveHistoryToStorage = (history: HistoryItem[]) => {
  setMemory(STORAGE_KEY, JSON.stringify(history));
};

const initialState: TranslateState = {
  sourceText: "",
  targetText: "",
  sourceLang: "auto", // 自动检测
  targetLang: "zh-CN", // 默认目标语言为简体中文
  model: "", // 默认空，由系统从可用模型中选择
  isTranslating: false,
  
  settings: {
    markdownPreview: true,
    autoCopy: false,
    syncScroll: false,
    detectMethod: "auto",
    bidirectional: false,
    systemPrompt: `You are a professional translator. Your only task is to translate text enclosed with <translate_input> tags into {{target_language}} without any explanation, and keep original format. Never write code, answer questions, or explain.

<translate_input>
{{text}}
</translate_input>`,
  },
  
  customLanguages: [],
  history: loadHistoryFromStorage(),
};

// --- 3. Slice 定义 ---

export const translateSlice = createSlice({
  name: "translate",
  initialState,
  reducers: {
    // --- 基础输入/输出控制 ---
    setSourceText: (state, action: PayloadAction<string>) => {
      state.sourceText = action.payload;
      state.targetText = ""; // 清空结果
    },
    setTargetText: (state, action: PayloadAction<string>) => {
      state.targetText = action.payload;
    },
    appendTargetText: (state, action: PayloadAction<string>) => {
      state.targetText += action.payload;
    },
    setSourceLang: (state, action: PayloadAction<string>) => {
      state.sourceLang = action.payload;
    },
    setTargetLang: (state, action: PayloadAction<string>) => {
      state.targetLang = action.payload;
    },
    setTranslateModel: (state, action: PayloadAction<string>) => {
      state.model = action.payload;
    },
    swapLangs: (state) => {
      // 交换语言，如果源语言是 auto，目标语言变为 'auto' (或保持原目标语言)
      [state.sourceLang, state.targetLang] = [state.targetLang, state.sourceLang];
      if (state.sourceLang === 'auto' && state.targetLang !== 'auto') {
          // 简化的处理：直接交换，如果原源语言是 auto，新源语言就是原目标语言
      }
    },
    setIsTranslating: (state, action: PayloadAction<boolean>) => {
      state.isTranslating = action.payload;
    },
    
    // --- 设置控制 ---
    toggleMarkdownPreview: (state) => {
      state.settings.markdownPreview = !state.settings.markdownPreview;
    },
    toggleAutoCopy: (state) => {
      state.settings.autoCopy = !state.settings.autoCopy;
    },
    toggleSyncScroll: (state) => {
      state.settings.syncScroll = !state.settings.syncScroll;
    },
    setDetectMethod: (state, action: PayloadAction<"auto" | "algorithm" | "llm">) => {
        state.settings.detectMethod = action.payload;
    },
    setSystemPrompt: (state, action: PayloadAction<string>) => {
      state.settings.systemPrompt = action.payload;
    },
    
    // --- 历史记录与自定义语言控制 ---
    addHistoryItem: {
        reducer(state, action: PayloadAction<Omit<HistoryItem, 'id' | 'timestamp'>>) {
            const newItem: HistoryItem = {
                ...action.payload,
                id: Math.random().toString(36).substring(2, 9),
                timestamp: Date.now(),
            };
            // 将新记录放在最前面
            state.history.unshift(newItem);
            // 限制历史记录数量，例如保留最近的 100 条
            if (state.history.length > 100) {
                state.history.pop();
            }
            saveHistoryToStorage(state.history);
        },
        prepare(sourceText: string, targetText: string, sourceLang: string, targetLang: string) {
            return { payload: { sourceText, targetText, sourceLang, targetLang } };
        }
    },
    clearHistory: (state) => {
      state.history = [];
      saveHistoryToStorage(state.history);
    },
    loadHistory: (state, action: PayloadAction<HistoryItem[]>) => {
        state.history = action.payload;
        saveHistoryToStorage(state.history);
    },
    
    // 自定义语言管理
    addCustomLanguage: (state, action: PayloadAction<CustomLanguage>) => {
        state.customLanguages.push(action.payload);
    },
    removeCustomLanguage: (state, action: PayloadAction<string>) => {
        state.customLanguages = state.customLanguages.filter(lang => lang.code !== action.payload);
    },
    loadCustomLanguages: (state, action: PayloadAction<CustomLanguage[]>) => {
        state.customLanguages = action.payload;
    },
  },
});

export const {
  setSourceText,
  setTargetText,
  appendTargetText,
  setSourceLang,
  setTargetLang,
  setTranslateModel,
  swapLangs,
  setIsTranslating,
  toggleMarkdownPreview,
  toggleAutoCopy,
  toggleSyncScroll,
  setSystemPrompt,
  addHistoryItem,
  clearHistory,
  loadHistory,
  addCustomLanguage,
  removeCustomLanguage,
  loadCustomLanguages,
  setDetectMethod,
} = translateSlice.actions;

// --- 4. Selector 定义 ---
export const selectSourceText = (state: RootState) => state.translate.sourceText;
export const selectTargetText = (state: RootState) => state.translate.targetText;
export const selectSourceLang = (state: RootState) => state.translate.sourceLang;
export const selectTargetLang = (state: RootState) => state.translate.targetLang;
export const selectTranslateModel = (state: RootState) => state.translate.model;
export const selectIsTranslating = (state: RootState) => state.translate.isTranslating;

export const selectSettings = (state: RootState) => state.translate.settings;
export const selectCustomLanguages = (state: RootState) => state.translate.customLanguages;
export const selectHistory = (state: RootState) => state.translate.history;

export default translateSlice.reducer;