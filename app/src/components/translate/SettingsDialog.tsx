import React, { useState, useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectSettings,
  selectCustomLanguages,
  toggleMarkdownPreview,
  toggleAutoCopy,
  toggleSyncScroll,
  setSystemPrompt,
  addCustomLanguage,
  removeCustomLanguage,
  setDetectMethod,
  setTranslateModel,
  selectTranslateModel,
} from "@/store/translate";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { selectSupportModels } from "@/store/chat.ts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";

interface SettingsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

const defaultLangs: { emoji: string, name: string, code: string }[] = [
    { emoji: "🇪🇺", name: "EuroLang", code: "eu-FR" },
    { emoji: "🇰🇷", name: "Hangul", code: "ko-KR" },
];

const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onOpenChange }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  
  const settings = useSelector(selectSettings);
  const customLangs = useSelector(selectCustomLanguages);
  const currentModel = useSelector(selectTranslateModel);
  const supportModels = useSelector(selectSupportModels);
  
  const [localPrompt, setLocalPrompt] = useState(settings.systemPrompt);
  const [newLangName, setNewLangName] = useState('');
  const [newLangCode, setNewLangCode] = useState('');

  // 确保本地状态和 Redux 状态同步
  useEffect(() => {
    setLocalPrompt(settings.systemPrompt);
  }, [settings.systemPrompt]);

  const handleSavePrompt = useCallback(() => {
    dispatch(setSystemPrompt(localPrompt));
    alert(t('settings.prompt-saved')); // 实际应使用 Toast
  }, [dispatch, localPrompt, t]);
  
  const handleAddLang = useCallback(() => {
    if (newLangName && newLangCode) {
        dispatch(addCustomLanguage({ 
            emoji: '✨', // 默认表情
            name: newLangName, 
            code: newLangCode 
        }));
        setNewLangName('');
        setNewLangCode('');
    }
  }, [dispatch, newLangName, newLangCode]);

  const handleRemoveLang = useCallback((code: string) => {
    dispatch(removeCustomLanguage(code));
  }, [dispatch]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{t('translate.settings.title', 'Translation Settings')}</DialogTitle>
          <DialogDescription>
            {t('translate.settings.description', 'Configure translation behavior and custom languages.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          
          {/* --- 图四内容：快速设置复用 --- */}
          <div className="border-b pb-4 space-y-3">
             <h3 className="font-semibold text-md">{t('translate.settings.quickSettings', 'Quick Controls')}</h3>
             <div className="flex items-center justify-between">
                <Label htmlFor="markdown-preview">{t('translate.settings.markdownPreview', 'Markdown Preview')}</Label>
                <Switch 
                    id="markdown-preview" 
                    checked={settings.markdownPreview} 
                    onCheckedChange={() => dispatch(toggleMarkdownPreview())} 
                />
            </div>
            <div className="flex items-center justify-between">
                <Label htmlFor="auto-copy">{t('translate.settings.autoCopy', 'Auto Copy Result')}</Label>
                <Switch 
                    id="auto-copy" 
                    checked={settings.autoCopy} 
                    onCheckedChange={() => dispatch(toggleAutoCopy())} 
                />
            </div>
            <div className="flex items-center justify-between">
                <Label htmlFor="sync-scroll">{t('translate.settings.syncScroll', 'Sync Scroll Position')}</Label>
                <Switch 
                    id="sync-scroll" 
                    checked={settings.syncScroll} 
                    onCheckedChange={() => dispatch(toggleSyncScroll())} 
                />
            </div>

            <div className="space-y-2">
                <Label>{t('translate.settings.detectMethod', 'Detection Method')}</Label>
                <ToggleGroup 
                    type="single" 
                    value={settings.detectMethod} 
                    onValueChange={(v) => dispatch(setDetectMethod(v as "auto" | "algorithm" | "llm"))}
                    className="flex justify-start w-full"
                >
                    <ToggleGroupItem value="auto">{t('translate.settings.auto', 'Auto')}</ToggleGroupItem>
                    <ToggleGroupItem value="algorithm">{t('translate.settings.algorithm', 'Algorithm')}</ToggleGroupItem>
                    <ToggleGroupItem value="llm">{t('translate.settings.llm', 'LLM')}</ToggleGroupItem>
                </ToggleGroup>
            </div>

            <div className="space-y-2">
                <Label>{t('translate.modelSelector', 'Translation Model')}</Label>
                <Select value={currentModel || (supportModels.length > 0 ? supportModels[0].id : "")} onValueChange={(v) => dispatch(setTranslateModel(v))}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('market.model')} />
                    </SelectTrigger>
                    <SelectContent>
                        {supportModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                                {model.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </div>


          {/* --- 图三内容：翻译提示词设置 --- */}
          <div className="space-y-2">
            <Label htmlFor="system-prompt">{t('translate.settings.promptSetting', 'Translation System Prompt')}</Label>
            <Textarea
              id="system-prompt"
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
                {t('translate.settings.promptTip', 'Use <translate_input> and {{target_language}} as placeholders.')}
            </p>
            <Button variant="secondary" size="sm" onClick={handleSavePrompt}>
                {t('save', 'Save')}
            </Button>
          </div>

          {/* --- 图三内容：自定义语言设置 --- */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Label>{t('translate.settings.customLang', 'Custom Languages')}</Label>
                <Button variant="outline" size="sm" onClick={handleAddLang}>
                    <Plus className="w-4 h-4 mr-1" /> {t('add', 'Add')}
                </Button>
            </div>
            
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[10%]">{t('emoji', 'Emoji')}</TableHead>
                        <TableHead className="w-[35%]">{t('name', 'Name')}</TableHead>
                        <TableHead className="w-[35%]">{t('code', 'Code')}</TableHead>
                        <TableHead className="w-[20%]">{t('action', 'Action')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {customLangs.map((lang) => (
                        <TableRow key={lang.code}>
                            <TableCell className="font-mono">{lang.emoji}</TableCell>
                            <TableCell>{lang.name}</TableCell>
                            <TableCell className="font-mono text-sm">{lang.code}</TableCell>
                            <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveLang(lang.code)}>
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                     {defaultLangs.map((lang) => (
                        <TableRow key={lang.code} className="opacity-50">
                            <TableCell className="font-mono">{lang.emoji}</TableCell>
                            <TableCell>{lang.name} (Default)</TableCell>
                            <TableCell className="font-mono text-sm">{lang.code}</TableCell>
                            <TableCell>
                                <Button variant="ghost" size="icon" disabled>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                    {customLangs.length === 0 && defaultLangs.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                                {t('no-data', 'No data found.')}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            {/* Add New Row */}
            <TableRow>
                <TableCell className="font-mono">✨</TableCell>
                <TableCell>
                    <Input value={newLangName} onChange={(e) => setNewLangName(e.target.value)} placeholder={t('name', 'Name')} />
                </TableCell>
                <TableCell>
                    <Input value={newLangCode} onChange={(e) => setNewLangCode(e.target.value)} placeholder={t('code', 'Code (e.g., en-US)')} />
                </TableCell>
                <TableCell>
                    <Button variant="ghost" size="icon" onClick={handleAddLang} disabled={!newLangName || !newLangCode}>
                        <Plus className="w-4 h-4 text-primary" />
                    </Button>
                </TableCell>
            </TableRow>
          </div>


        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('close', 'Close')}
          </Button>
          {/* 保存按钮在每个区域内实现了，这里可以简化 */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;