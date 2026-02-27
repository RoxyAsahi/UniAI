import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    selectHistory,
    setSourceText,
    setTargetText,
    setSourceLang,
    setTargetLang,
    clearHistory,
} from "@/store/translate";
import { Button } from "@/components/ui/button.tsx";
import { Trash2, History as HistoryIcon, Loader2, Star, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/components/ui/lib/utils.ts";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { toast } from "sonner";
import { Input } from "@/components/ui/input.tsx";

interface HistorySidebarProps {}

const langMap: Record<string, string> = {
    "zh-CN": "简体中文",
    "zh-TW": "繁体中文",
    "en": "英文",
    "ja": "日文",
    "ko": "韩文",
    "auto": "自动检测",
};

const HistorySidebar: React.FC<HistorySidebarProps> = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    
    const history = useSelector(selectHistory);
    const [isLoading, setIsLoading] = useState(true); 
    const [search, setSearch] = useState("");
    
    useEffect(() => {
        const mockLoad = setTimeout(() => {
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(mockLoad);
    }, []); 

    const filteredHistory = useMemo(() => {
        if (!search) return history;
        const lowerSearch = search.toLowerCase();
        return history.filter(item => 
            item.sourceText.toLowerCase().includes(lowerSearch) || 
            item.targetText.toLowerCase().includes(lowerSearch)
        );
    }, [history, search]);

    const handleLoadHistory = useCallback((item: typeof history[0]) => {
        dispatch(setSourceText(item.sourceText));
        dispatch(setTargetText(item.targetText));
        dispatch(setSourceLang(item.sourceLang));
        dispatch(setTargetLang(item.targetLang));
        toast(t('translate.historyLoaded', 'History restored to editor.')); 
    }, [dispatch, t]);

    const handleClearHistory = useCallback(() => {
        if (confirm(t('conversation.remove-all-description', 'This action cannot be undone. Continue?'))) {
            dispatch(clearHistory());
            toast(t('conversation.delete-success-prompt', 'History cleared.'));
        }
    }, [dispatch, t]);

    const formatTime = (ts: number) => {
        const date = new Date(ts);
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        const h = date.getHours().toString().padStart(2, '0');
        const min = date.getMinutes().toString().padStart(2, '0');
        return `${m}/${d} ${h}:${min}`;
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center p-6 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                    <p>{t('loading', 'Loading...')}</p>
                </div>
            );
        }
        
        if (filteredHistory.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center p-6 text-muted-foreground text-center">
                    <HistoryIcon className="w-8 h-8 mb-2" />
                    <p>{t('translate.emptyPlaceholder', 'No history yet.')}</p>
                </div>
            );
        }

        return (
            <ScrollArea className="flex-grow"> 
                <div className="flex flex-col">
                    {filteredHistory.map((item) => (
                        <div 
                            key={item.id} 
                            className={cn(
                                "p-4 border-b border-dashed border-border cursor-pointer transition-colors",
                                "hover:bg-accent/30"
                            )}
                            onClick={() => handleLoadHistory(item)}
                        >
                            <div className="text-[13px] text-muted-foreground flex justify-between mb-2">
                                <span>{langMap[item.sourceLang] || item.sourceLang} → {langMap[item.targetLang] || item.targetLang}</span>
                            </div>
                            <p className="text-[14px] font-bold text-foreground line-clamp-2 mb-1">{item.sourceText}</p>
                            <p className="text-[14px] text-muted-foreground line-clamp-2 mb-3">{item.targetText}</p>
                            <div className="text-[12px] text-muted-foreground/60">
                                {formatTime(item.timestamp)}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        );
    };

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button id="history-sheet-trigger" variant="ghost" size="icon" title={t('translate.history', 'History')} className="flex items-center justify-center p-2 rounded-md hover:bg-accent/50 transition-colors">
                    <HistoryIcon className="w-5 h-5 text-secondary-foreground" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-80 flex flex-col [&>button]:hidden">
                <SheetHeader className="p-4 flex flex-row justify-between items-center shrink-0">
                    <div className="flex items-center space-x-2">
                        <SheetTitle className="text-base font-semibold">{t('translate.history', 'History')}</SheetTitle>
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 cursor-pointer" />
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleClearHistory} 
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 flex items-center space-x-1 px-2"
                        disabled={history.length === 0 || isLoading}
                    >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-sm">{t('translate.clearHistory', 'Clear History')}</span>
                    </Button>
                </SheetHeader>

                <div className="px-4 pb-2 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('translate.searchHistory', 'Search history')}
                            className="pl-9 h-9 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>
                </div>

                <div className="flex-grow min-h-0 border-t border-border mt-2">
                    {renderContent()}
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default HistorySidebar;