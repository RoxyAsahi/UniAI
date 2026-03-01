import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary.tsx";
import "@/assets/pages/home.less"; // 保留，可能仍有全局样式依赖
import { Button } from "@/components/ui/button.tsx";
import {
  ChevronDown,
  MessageCircle,
  Shield,
  Wallet,
  LibraryBig,
  Compass,
  User,
  Languages,
  LayoutGrid, // 小程序图标
} from "lucide-react";
import Icon from "@/components/utils/Icon.tsx";
import router from "@/router.tsx";
import { useTranslation } from "react-i18next";
import { cn } from "@/components/ui/lib/utils.ts";
import { useSelector } from "react-redux";
import { selectAdmin } from "@/store/auth.ts";
import {
  hideToolbarSelector,
  hideToolbarTextSelector,
} from "@/store/settings.ts";
import { isMobile, useMobile } from "@/utils/device.ts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import NavBar from "@/components/app/NavBar.tsx";

// --- 路由辅助组件 (沿用 Index.tsx 逻辑) ---

type BarItemProps = {
  icon: React.ReactElement;
  path: string;
  name: string;
};

function isPrefix(current: string, path: string): boolean {
  if (location.pathname === path) return true;
  if (location.pathname + "/" === path) return true;

  return path.length > 1 && current.startsWith(path + "/");
}

function BarItem({ icon, path, name }: BarItemProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const active = isPrefix(location.pathname, path);

  const hidden = useSelector(hideToolbarTextSelector);
  const mobile = useMobile();

  const [open, setOpen] = useState(false);

  const onClick = async () => {
    await router.navigate(path);
  };

  return (
    <div className={`inline-flex flex-col`}>
      <TooltipProvider delayDuration={100}>
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={active ? "default" : "outline"}
              onClick={onClick}
            >
              <Icon icon={icon} className="h-4 w-4 stroke-[1.75]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side={mobile ? "top" : "right"}
            align="center"
            className={`z-[100]`}
          >
            {/* 翻译页面的 bar 项需要专门的 i18n key */}
            {t(`bar.${name}`, name)} 
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <div
        className={cn(
          `toolbar-text text-secondary text-center text-xs mt-1.5 cursor-pointer select-none`,
          active && `text-common`,
          hidden && `hidden`,
        )}
        onClick={onClick}
      >
        {t(`bar.${name}`, name)}
      </div>
    </div>
  );
}

function ToolBar() {
  const admin = useSelector(selectAdmin);
  const hideToolbar = useSelector(hideToolbarSelector);
  const [stacked, setStacked] = useState(hideToolbar || isMobile());

  return (
    <div className={cn("toolbar", stacked && "stacked")}>
      <div
        className={cn("bar-kit", stacked && "stacked")}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setStacked(!stacked);
        }}
      >
        <ChevronDown className={`h-3.5 w-3.5`} />
      </div>
      <BarItem icon={<MessageCircle />} path={`/`} name={`chat`} />
      <BarItem icon={<LibraryBig />} path={`/model`} name={`model`} />
      <BarItem icon={<Compass />} path={`/preset`} name={`preset`} />
      {/* 翻译入口 */}
      <BarItem icon={<Languages />} path={`/translate`} name={`translate`} />
      {/* 小程序入口 */}
      <BarItem icon={<LayoutGrid />} path={`/apps`} name={`miniapps`} />
      <BarItem icon={<Wallet />} path={`/wallet`} name={`wallet`} />
      <BarItem icon={<User />} path={`/account`} name={`account`} />
      {admin && <BarItem icon={<Shield />} path={`/admin`} name={`admin`} />}
    </div>
  );
}

function Home() {
  const location = useLocation();
  const chatRoute = location.pathname === "/";

  return (
    <ErrorBoundary>
      <NavBar hidden={chatRoute} />
      <div className={cn(`main relative`, chatRoute && "chat-navbarless")}>
        <ToolBar />
        <Outlet />
      </div>
    </ErrorBoundary>
  );
}

export default Home;
