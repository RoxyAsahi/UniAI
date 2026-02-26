import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectSettings,
  toggleMarkdownPreview,
  toggleAutoCopy,
  toggleSyncScroll,
} from "@/store/translate";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useTranslation } from "react-i18next";
import { Settings, SlidersHorizontal } from "lucide-react";
import SettingsDialog from "./SettingsDialog"; 

interface QuickSettingsProps {}

const QuickSettings: React.FC<QuickSettingsProps> = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  
  const settings = useSelector(selectSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" title={t('translate.settings.quickSettingsTitle', 'Quick Settings')}>
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-4 space-y-4 z-50">
          
          <h4 className="font-semibold text-sm">{t('translate.settings.quickSettings', 'Quick Controls')}</h4>

          <div className="flex items-center justify-between">
            <Label htmlFor="q-markdown">{t('translate.settings.markdownPreview', 'Markdown Preview')}</Label>
            <Switch 
                id="q-markdown" 
                checked={settings.markdownPreview} 
                onCheckedChange={() => dispatch(toggleMarkdownPreview())} 
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="q-autocopy">{t('translate.settings.autoCopy', 'Auto Copy')}</Label>
            <Switch 
                id="q-autocopy" 
                checked={settings.autoCopy} 
                onCheckedChange={() => dispatch(toggleAutoCopy())} 
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="q-sync">{t('translate.settings.syncScroll', 'Sync Scroll')}</Label>
            <Switch 
                id="q-sync" 
                checked={settings.syncScroll} 
                onCheckedChange={() => dispatch(toggleSyncScroll())} 
            />
          </div>

          <div className="pt-2 border-t space-y-2">
            <Button variant="outline" className="w-full" onClick={() => setIsSettingsOpen(true)}>
                <Settings className="w-4 h-4 mr-2" /> {t('translate.settings.moreSettings', 'More Settings')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      
      <SettingsDialog isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </>
  );
};

export default QuickSettings;