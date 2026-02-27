import React, { useCallback, useRef, useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectSourceText,
  selectTargetText,
  selectSourceLang,
  selectTargetLang,
  selectSettings,
  selectIsTranslating,
  selectTranslateModel,
  setSourceText,
  setTargetText,
  setSourceLang,
  setTargetLang,
  swapLangs,
  setIsTranslating,
  addHistoryItem,
} from "@/store/translate";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { cn } from "@/components/ui/lib/utils.ts";
import { useTranslation } from "react-i18next";
import { Loader2, ClipboardCopy, ArrowLeftRight, Send, X, ChevronUp, ChevronDown, StopCircle } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import QuickSettings from "./SettingsPopover"; 
import HistorySidebar from "./HistorySidebar"; 
import { stack } from "@/store/chat.ts";
import { selectSupportModels } from "@/store/chat.ts";
import ModelAvatar from "@/components/ModelAvatar.tsx";
import SettingsDialog from "./SettingsDialog";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";

const TRANSLATION_ID = -1001; // 虚拟连接 ID 用于翻译任务

const LanguageSelect = ({ value, disabled, isSource, onChange }: { value: string, disabled: boolean, isSource: boolean, onChange: (v: string) => void }) => {
    const { t } = useTranslation();
    const languages = [
        { name: t('translate.autoDetect', 'Auto-Detect'), code: 'auto', hidden: !isSource },
        { name: '简体中文', code: 'zh-CN' },
        { name: 'English', code: 'en' },
        { name: '日本語', code: 'ja' },
        { name: '한국어', code: 'ko' },
        { name: '繁體中文', code: 'zh-TW' },
    ];

    return (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="min-w-[120px] h-9">
                <SelectValue placeholder={isSource ? t('translate.from') : t('translate.to')} />
            </SelectTrigger>
            <SelectContent>
                {languages.map((lang) => (
                    (!lang.hidden || value === lang.code) && (
                        <SelectItem key={lang.code} value={lang.code}>
                            {lang.name}
                        </SelectItem>
                    )
                ))}
            </SelectContent>
        </Select>
    );
};

const TranslatePanel: React.FC = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  
  const sourceText = useSelector(selectSourceText);
  const targetText = useSelector(selectTargetText);
  const sourceLang = useSelector(selectSourceLang);
  const targetLang = useSelector(selectTargetLang);
  const settings = useSelector(selectSettings);
  const isTranslating = useSelector(selectIsTranslating);
  const translateModel = useSelector(selectTranslateModel);
  const supportModels = useSelector(selectSupportModels);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const currentModel = useMemo(() => {
    return supportModels.find((m) => m.id === translateModel) || supportModels[0];
  }, [supportModels, translateModel]);

  const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch(setSourceText(e.target.value));
  }, [dispatch]);

  // 检测输入框是否溢出
  useEffect(() => {
    const checkOverflow = () => {
      const el = inputRef.current;
      if (el) {
        setIsOverflowing(el.scrollHeight > el.clientHeight);
      }
    };
    
    checkOverflow();
    // 监听窗口大小变化
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [sourceText]);

  // 处理平滑滚动
  const handleScrollByAmount = useCallback((amount: number) => {
    const el = inputRef.current;
    if (el) {
      el.scrollBy({ top: amount, behavior: 'smooth' });
    }
  }, []);

  // --- 2. 翻译逻辑 ---
  const stopTranslation = useCallback(() => {
    stack.sendStopEvent(TRANSLATION_ID, t);
    dispatch(setIsTranslating(false));
  }, [dispatch, t]);

  const triggerTranslation = useCallback(() => {
    if (isTranslating || !sourceText.trim()) return;

    const model = translateModel || (supportModels.length > 0 ? supportModels[0].id : "gpt-3.5-turbo");
    
    dispatch(setTargetText(""));
    dispatch(setIsTranslating(true));

    if (!stack.hasConnection(TRANSLATION_ID)) {
      stack.createConnection(TRANSLATION_ID);
    }

    // 监听流式回调已由 AppProvider 全局处理，并路由到了 translate/appendTargetText
    // 我们只需要在这里发起请求

    // 组装 Prompt
    let finalPrompt = settings.systemPrompt;
    
    // 如果提示词中没有 {{text}} 占位符，自动在末尾追加
    if (!finalPrompt.includes("{{text}}")) {
        finalPrompt += "\n\n<translate_input>\n{{text}}\n</translate_input>";
    }

    const langMap: Record<string, string> = {
        "zh-CN": "Simplified Chinese",
        "zh-TW": "Traditional Chinese",
        "en": "English",
        "ja": "Japanese",
        "ko": "Korean",
        "auto": "Automatic Detection",
    };

    finalPrompt = finalPrompt
        .replace(/{{text}}/g, () => sourceText)
        .replace(/{{target_language}}/g, () => langMap[targetLang] || targetLang);

    // 发送请求
    const state = stack.send(TRANSLATION_ID, t, {
      message: finalPrompt,
      model: model,
      ignore_context: true, // 翻译不需要上下文
    });

    if (!state) {
        // 如果连接没准备好，尝试重新创建
        stack.createConnection(TRANSLATION_ID);
        setTimeout(() => {
            const retryState = stack.send(TRANSLATION_ID, t, {
                message: finalPrompt,
                model: model,
                ignore_context: true,
            });
            if (!retryState) {
                dispatch(setIsTranslating(false));
                toast.error(t('request-failed'));
            }
        }, 1000);
    }
  }, [isTranslating, sourceText, translateModel, supportModels, settings, targetLang, dispatch, t]);

  // 翻译完成后的处理（历史记录 & 自动复制）
  useEffect(() => {
      if (!isTranslating && targetText && sourceText) {
          // 防止初始状态触发，只有在真正翻译完后触发
          // 比较简单的方法是在 triggerTranslation 的回调里做，但 Redux 状态更新是异步的
          // 我们在这里仅处理“存入历史”，因为 handleTranslate 被调用时 targetText 是空的
      }
  }, [isTranslating, targetText]);

  // 为了解决回调中无法拿到最新 state 的问题，我们可以直接在回调中利用 dispatch 的 payload 累加，
  // 并在 message.end 时执行一次性的副作用。
  
  // 监听翻译结束
  const prevIsTranslating = useRef(isTranslating);
  useEffect(() => {
      if (prevIsTranslating.current && !isTranslating && targetText) {
          // 翻译刚刚结束
          dispatch(addHistoryItem(sourceText, targetText, sourceLang, targetLang));
          if (settings.autoCopy) {
              navigator.clipboard.writeText(targetText);
              toast.success(t('message.copy'));
          }
      }
      prevIsTranslating.current = isTranslating;
  }, [isTranslating, targetText, sourceText, sourceLang, targetLang, settings.autoCopy, dispatch, t]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!settings.syncScroll || isTranslating) return;

    const inputEl = inputRef.current;
    const outputEl = e.currentTarget;

    if (inputEl && outputEl) {
        const inputContainer = inputEl.parentElement; 
        if (!inputContainer) return;
        
        const inputScrollHeight = inputEl.scrollHeight - inputEl.clientHeight;
        const outputScrollHeight = outputEl.scrollHeight - outputEl.clientHeight;
        
        if (inputScrollHeight <= 0 && outputScrollHeight <= 0) return;

        if (outputEl.scrollTop > 0 && inputContainer.scrollTop === 0) {
            const scrollRatio = outputEl.scrollTop / outputScrollHeight;
            inputEl.scrollTop = scrollRatio * inputScrollHeight;
        } else if (inputContainer.scrollTop > 0 && outputEl.scrollTop === 0) {
            const scrollRatio = inputContainer.scrollTop / inputScrollHeight;
            outputEl.scrollTop = scrollRatio * outputScrollHeight;
        }
    }
  }, [settings.syncScroll, isTranslating]);
  
  const handleCopy = useCallback((text: string) => {
      navigator.clipboard.writeText(text).then(() => {
          toast(t('message.copy'));
      });
  }, [t]);


  return (
    <div className="flex flex-col h-full w-full bg-background relative">
      {/* 顶部工具栏 */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-border shrink-0 bg-background/95 backdrop-blur z-10 sticky top-0 h-[60px]">
        <div className="flex items-center space-x-2">
            <HistorySidebar /> 
            
            <div className="h-4 w-px bg-border mx-2"></div>

            <LanguageSelect value={sourceLang} disabled={isTranslating} isSource={true} onChange={(v) => dispatch(setSourceLang(v))} />
            <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => dispatch(swapLangs())}
                disabled={isTranslating}
                className="text-muted-foreground mx-1"
            >
                <ArrowLeftRight className="w-4 h-4" />
            </Button>
            <LanguageSelect value={targetLang} disabled={isTranslating} isSource={false} onChange={(v) => dispatch(setTargetLang(v))} />

            {/* 翻译/停止按钮 */}
            <Button 
              className={cn(
                  "ml-4 space-x-2 px-4 h-9 shadow-sm transition-all active:scale-95 whitespace-nowrap min-w-[100px]",
                  isTranslating 
                    ? "bg-red-500 hover:bg-red-600 text-white" 
                    : sourceText.trim() 
                      ? "bg-[#10a37f] hover:bg-[#0e8c6d] text-white border-none" 
                      : "bg-[#f5f5f5] text-[#b8b8b8] border border-[#b8b8b8] hover:bg-[#f0f0f0]"
              )}
              onClick={isTranslating ? stopTranslation : triggerTranslation}
              disabled={!isTranslating && !sourceText.trim()}
            >
              {isTranslating ? (
                  <>
                    <StopCircle className="w-4 h-4 shrink-0" />
                    <span className="font-medium">{t('stop', 'Stop')}</span>
                  </>
              ) : (
                  <>
                    <Send className="w-4 h-4 shrink-0" />
                    <span className="font-medium">{t('translate.translateBtn', 'Translate')}</span>
                  </>
              )}
            </Button>
        </div>

        <div className="flex items-center space-x-1">
           {currentModel && (
             <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsSettingsOpen(true)}>
                <ModelAvatar model={currentModel} size={24} />
             </Button>
           )}
           <QuickSettings />
        </div>
      </div>

      {/* 主工作区 */}
      <div className="flex flex-grow w-full overflow-hidden p-4 gap-4 bg-muted/10"> 
        {/* 左侧输入区 */}
        <div className="w-1/2 flex flex-col relative border border-border rounded-xl bg-background shadow-sm group/input">
          <div className="relative flex-grow min-h-0 overflow-hidden">
              <Textarea
                ref={inputRef}
                value={sourceText}
                onChange={handleSourceChange}
                disabled={isTranslating}
                placeholder={t('chat.placeholder-raw', 'Write something...')}
                className={cn(
                    "absolute inset-0 w-full h-full resize-none text-base !ring-0 !border-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none transition-none p-4 bg-transparent leading-relaxed overflow-y-auto scrollbar-none min-h-0", 
                )}
                onScroll={(e) => {
                    const el = e.currentTarget;
                    setIsOverflowing(el.scrollHeight > el.clientHeight);
                }}
              />

              {/* 右上角浮动控制组 */}
              <div className="absolute top-4 right-4 flex flex-col items-center space-y-2 opacity-0 group-hover/input:opacity-100 transition-opacity z-20">
                <Button 
                    variant="secondary" 
                    size="icon" 
                    className="h-8 w-8 rounded-full shadow-sm bg-muted/50 hover:bg-muted" 
                    onClick={() => dispatch(setSourceText(""))} 
                    disabled={isTranslating || !sourceText}
                >
                    <X className="w-4 h-4" />
                </Button>
                
                {isOverflowing && (
                  <div className="flex flex-col border border-border rounded-lg bg-background shadow-sm overflow-hidden">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-none border-b border-border hover:bg-muted" 
                        onClick={() => handleScrollByAmount(-150)}
                    >
                        <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-none hover:bg-muted" 
                        onClick={() => handleScrollByAmount(150)}
                    >
                        <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
          </div>
          
          <div className="flex justify-between items-center text-xs text-muted-foreground px-4 py-2 border-t border-border/40 shrink-0 min-h-[32px]">
            {/* 字符计数和重复的清空按钮已根据要求移除 */}
          </div>
        </div>

        {/* 右侧输出区 */}
        <div 
            ref={outputRef} 
            className={cn(
                "w-1/2 p-4 border border-border rounded-xl relative bg-[#f5f5f5] shadow-sm overflow-y-auto", 
                settings.syncScroll && "overflow-y-hidden" 
            )}
            onScroll={settings.syncScroll && !isTranslating ? handleScroll : undefined}
        >
          {isTranslating && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#10a37f]" />
                <span className="text-[#10a37f] font-medium">{t('chat.thinking', 'Thinking...')}</span>
            </div>
          )}
          
          <div className={cn("whitespace-pre-wrap min-h-full pb-12 leading-relaxed", isTranslating && "opacity-50")}>
            {targetText ? (
                settings.markdownPreview ? (
                    <ReactMarkdown className="prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0">
                        {targetText}
                    </ReactMarkdown>
                ) : (
                    <p className="text-base">{targetText}</p>
                )
            ) : (
                <div className="flex h-full items-center justify-center opacity-40">
                    <p className="text-base text-muted-foreground text-center max-w-[80%] italic">
                        {t('translate.emptyPreview', 'The input will be rendered here (Markdown syntax supported)')}
                    </p>
                </div>
            )}
          </div>
          
          {/* 右下角复制按钮 */}
          <div className="absolute bottom-4 right-4 z-20">
            <Button 
                size="icon" 
                variant="secondary" 
                title={t('message.copy')}
                onClick={() => handleCopy(targetText)}
                disabled={!targetText || isTranslating}
                className="rounded-full h-10 w-10 shadow-md bg-[#10a37f] text-white hover:bg-[#0e8c6d] border-none"
            >
                <ClipboardCopy className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
      <SettingsDialog isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </div>
  );
};

export default TranslatePanel;