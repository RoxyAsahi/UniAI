import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { selectAuthenticated, selectUsername } from "@/store/auth.ts";
import { Button } from "@/components/ui/button.tsx";
import { Settings2 } from "lucide-react";
import { goAuth } from "@/utils/app.ts";
import Avatar from "@/components/Avatar.tsx";
import MenuBar from "@/components/app/MenuBar.tsx";
import ThemeToggle from "@/components/ThemeProvider.tsx";
import ProjectLink from "@/components/ProjectLink.tsx";
import { openDialog } from "@/store/settings.ts";
import { cn } from "@/components/ui/lib/utils.ts";

type NavActionsProps = {
  className?: string;
  floating?: boolean;
};

function NavMenu() {
  const username = useSelector(selectUsername);

  return (
    <div className={`avatar`}>
      <MenuBar>
        <Button
          variant={`ghost`}
          size={`icon-md`}
          className={`rounded-full overflow-hidden`}
          unClickable
        >
          <Avatar username={username} className={`w-9 h-9 rounded-full`} />
        </Button>
      </MenuBar>
    </div>
  );
}

export default function NavActions({ className, floating = false }: NavActionsProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const auth = useSelector(selectAuthenticated);

  return (
    <div
      className={cn(
        "nav-actions flex items-center gap-2",
        floating && "rounded-full border border-border/70 bg-background/78 px-2 py-1.5 shadow-sm backdrop-blur-md",
        className,
      )}
    >
      <ProjectLink />
      <ThemeToggle size="icon-md" className={`rounded-full overflow-hidden`} />
      <Button
        size={`icon-md`}
        variant={`outline`}
        className={`rounded-full overflow-hidden`}
        onClick={() => dispatch(openDialog())}
      >
        <Settings2 className={`w-4 h-4`} />
      </Button>
      {auth ? (
        <NavMenu />
      ) : (
        <Button size={`thin`} className={`rounded-full`} onClick={goAuth}>
          {t("login")}
        </Button>
      )}
    </div>
  );
}
