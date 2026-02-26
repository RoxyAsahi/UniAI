import "@/assets/pages/preset.less";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input.tsx";
import { useMemo, useState, useReducer } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch } from "@/store/index.ts";
import {
  selectCustomMasks,
  useConversationActions,
  updateMasks,
} from "@/store/chat.ts";
import { selectAuthenticated } from "@/store/auth.ts";
import { goAuth } from "@/utils/app.ts";
import { cn } from "@/components/ui/lib/utils.ts";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import router from "@/router.tsx";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { MASKS } from "@/masks/prompts.ts";
import { CustomMask, Mask, initialCustomMask } from "@/masks/types.ts";
import Emoji from "@/components/Emoji.tsx";
import { Button } from "@/components/ui/button.tsx";
import MaskEditor, { maskEditorReducer } from "@/components/home/MaskEditor.tsx";
import { deleteMask } from "@/api/mask.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Search,
  Plus,
  MessageSquare,
  MoreHorizontal,
  PencilLine,
  Trash2,
  User,
  Star,
  Briefcase,
  Handshake,
  Wrench,
  Languages,
  FileText,
  Settings,
  PenTool,
  Code2,
  Heart,
  GraduationCap,
  Lightbulb,
  BookOpen,
  Palette,
  Component,
  Gamepad2,
  Smile,
  Stethoscope,
  Dices,
  Music,
  MessageCircle,
  Library,
  HeartPulse,
  BarChart3,
  FlaskConical,
  Scale,
  MessagesSquare,
  Coins,
  Plane,
  Users,
} from "lucide-react";

const iconMap: Record<string, React.ReactNode> = {
  "all": <Star className="h-4 w-4 mr-2" />,
  "custom": <User className="h-4 w-4 mr-2" />,
  "职业": <Briefcase className="h-4 w-4 mr-2" />,
  "商业": <Handshake className="h-4 w-4 mr-2" />,
  "工具": <Wrench className="h-4 w-4 mr-2" />,
  "语言": <Languages className="h-4 w-4 mr-2" />,
  "办公": <FileText className="h-4 w-4 mr-2" />,
  "通用": <Settings className="h-4 w-4 mr-2" />,
  "写作": <PenTool className="h-4 w-4 mr-2" />,
  "编程": <Code2 className="h-4 w-4 mr-2" />,
  "情感": <Heart className="h-4 w-4 mr-2" />,
  "教育": <GraduationCap className="h-4 w-4 mr-2" />,
  "创意": <Lightbulb className="h-4 w-4 mr-2" />,
  "学术": <BookOpen className="h-4 w-4 mr-2" />,
  "设计": <Palette className="h-4 w-4 mr-2" />,
  "艺术": <Component className="h-4 w-4 mr-2" />,
  "娱乐": <Gamepad2 className="h-4 w-4 mr-2" />,
  "生活": <Smile className="h-4 w-4 mr-2" />,
  "医疗": <Stethoscope className="h-4 w-4 mr-2" />,
  "游戏": <Dices className="h-4 w-4 mr-2" />,
  "翻译": <Languages className="h-4 w-4 mr-2" />,
  "音乐": <Music className="h-4 w-4 mr-2" />,
  "点评": <MessageCircle className="h-4 w-4 mr-2" />,
  "百科": <Library className="h-4 w-4 mr-2" />,
  "健康": <HeartPulse className="h-4 w-4 mr-2" />,
  "分析": <BarChart3 className="h-4 w-4 mr-2" />,
  "科学": <FlaskConical className="h-4 w-4 mr-2" />,
  "法律": <Scale className="h-4 w-4 mr-2" />,
  "咨询": <MessagesSquare className="h-4 w-4 mr-2" />,
  "金融": <Coins className="h-4 w-4 mr-2" />,
  "旅游": <Plane className="h-4 w-4 mr-2" />,
  "管理": <Users className="h-4 w-4 mr-2" />,
};

function Preset() {
  const { t } = useTranslation();
  const auth = useSelector(selectAuthenticated);
  const customMasks = useSelector(selectCustomMasks);
  const { mask: setMaskAction } = useConversationActions();
  const dispatch = useDispatch<AppDispatch>();

  const [searchText, setSearchText] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorState, editorDispatch] = useReducer(maskEditorReducer, initialCustomMask);

  const categories = useMemo(() => {
    const baseCategories = [
      { id: "all", name: t("mask.system", "系统预设") },
      { id: "custom", name: t("mask.custom", "我的预设") },
    ];
    
    // Extract unique tags from builtin masks to create industry categories
    const allTags = new Set<string>();
    MASKS.forEach(mask => {
      mask.tags?.forEach(tag => allTags.add(tag));
    });
    
    const tagCategories = Array.from(allTags).map(tag => ({
      id: `tag-${tag}`,
      name: tag
    }));

    return [...baseCategories, ...tagCategories];
  }, [t]);

  const displayMasks = useMemo(() => {
    let source: (Mask | CustomMask)[] = [];
    if (selectedCategory === "custom") {
      source = customMasks;
    } else if (selectedCategory === "all") {
      source = [...customMasks, ...MASKS];
    } else if (selectedCategory.startsWith("tag-")) {
      const tag = selectedCategory.replace("tag-", "");
      source = MASKS.filter(m => m.tags?.includes(tag));
    } else {
      source = [...customMasks, ...MASKS];
    }

    if (searchText.trim().length === 0) return source;

    const searchLower = searchText.toLowerCase();
    return source.filter(
      (m) =>
        m.name.toLowerCase().includes(searchLower) ||
        (m.description && m.description.toLowerCase().includes(searchLower))
    );
  }, [selectedCategory, customMasks, searchText]);

  const openEditor = (mask?: CustomMask) => {
    if (!auth) {
      toast(t("login-require"), {
        action: {
          label: t("login"),
          onClick: goAuth,
        },
      });
      return;
    }
    
    if (mask) {
      editorDispatch({ type: "set-mask", payload: mask });
    } else {
      editorDispatch({ type: "reset" });
    }
    setEditorOpen(true);
  };

  const handleUseMask = async (mask: Mask) => {
    setMaskAction(mask);
    router.navigate("/");
    toast.info(t("mask.switch-preset"), {
      description: t("mask.switch-preset-desc"),
    });
  };

  const handleDeleteMask = async (id: number) => {
    if (!auth) return;
    const resp = await deleteMask(id);
    if (resp.status) {
      toast.success(t("success"));
      // update custom masks in redux
      await updateMasks(dispatch);
    } else {
      toast.error(t("error"), { description: resp.error });
    }
  };

  return (
    <div className="preset-page flex flex-row h-full w-full bg-background overflow-hidden">
      {/* Left Sidebar for Categories */}
      <div className="preset-sidebar flex flex-col w-[240px] border-r border-border shrink-0 bg-muted/10">
        <div className="p-4 pt-6 text-lg font-bold text-foreground select-none">
          {t("mask.market", "助手库")}
        </div>
        <ScrollArea className="flex-1 px-3">
          <div className="flex flex-col space-y-1 pb-4">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "secondary" : "ghost"}
                className={cn(
                  "justify-start h-10 w-full font-normal",
                  selectedCategory === cat.id && "bg-muted font-medium"
                )}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {iconMap[cat.id.startsWith("tag-") ? cat.id.replace("tag-", "") : cat.id] || <MessageSquare className="h-4 w-4 mr-2" />}
                {cat.name}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right Content Area */}
      <div className="preset-content flex flex-col flex-1 min-w-0 bg-background">
        <div className="flex items-center justify-between p-6 pb-2 border-b border-border bg-background/95 backdrop-blur z-10">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 bg-muted/50 border-transparent focus-visible:bg-background"
              placeholder={t("mask.search", "搜索预设名称或描述...")}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-3 ml-4">
            <Button variant="outline" onClick={() => openEditor()}>
              <Plus className="h-4 w-4 mr-2" />
              {t("mask.create", "创建助手")}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
            <AnimatePresence>
              {displayMasks.map((mask, index) => {
                const isCustom = "id" in mask && (mask as CustomMask).id !== -1;
                
                return (
                  <motion.div
                    key={isCustom ? `custom-${(mask as CustomMask).id}` : `builtin-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="group flex flex-col relative p-5 rounded-xl border border-border bg-card hover:shadow-md transition-all cursor-pointer"
                    onClick={() => handleUseMask(mask)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 flex items-center justify-center rounded-full bg-primary/10 text-2xl shrink-0">
                          <Emoji emoji={mask.avatar || "1f9d0"} />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <h3 className="font-semibold text-base truncate pr-2 text-foreground" title={mask.name}>
                            {mask.name}
                          </h3>
                          <div className="flex mt-1">
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal bg-muted text-muted-foreground">
                              {isCustom ? t("mask.custom", "我的") : t("mask.system", "系统")}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isCustom ? (
                              <>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditor(mask as CustomMask); }}>
                                  <PencilLine className="h-4 w-4 mr-2" />
                                  {t("mask.actions.edit", "编辑助手")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleUseMask(mask); }}>
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  {t("mask.actions.use", "使用预设")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteMask((mask as CustomMask).id); }} className="text-destructive focus:text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t("mask.actions.delete", "删除")}
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleUseMask(mask); }}>
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  {t("mask.actions.use", "使用预设")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditor({ ...mask, id: -1 } as CustomMask); }}>
                                  <PencilLine className="h-4 w-4 mr-2" />
                                  {t("mask.actions.copy-edit", "复制并编辑")}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground line-clamp-3 leading-relaxed min-h-[60px]">
                      {mask.description || (mask.context && mask.context.length > 0 ? mask.context[0].content : t("mask.context", { length: mask.context?.length || 0 }))}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {displayMasks.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                <p>{t("empty", "暂无数据")}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <MaskEditor
        mask={editorState}
        dispatch={editorDispatch}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
    </div>
  );
}

export default Preset;
