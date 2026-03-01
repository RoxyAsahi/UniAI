import "@/assets/pages/navbar.less";
import { useDispatch, useSelector } from "react-redux";
import {
  selectAuthenticated,
  validateToken,
} from "@/store/auth.ts";
import { Button } from "@/components/ui/button.tsx";
import { Menu } from "lucide-react";
import { useEffect } from "react";
import { tokenField } from "@/conf/bootstrap.ts";
import { toggleMenu } from "@/store/menu.ts";
import router from "@/router.tsx";
import { getMemory } from "@/utils/memory.ts";
import { appLogo } from "@/conf/env.ts";
import { refreshQuota } from "@/store/quota.ts";
import { refreshSubscription } from "@/store/subscription.ts";
import { useEffectAsync } from "@/utils/hook.ts";
import { AppDispatch, clearCronJobs, createCronJob } from "@/store";
import { selectLogoText } from "@/store/info.ts";
import NavActions from "@/components/app/NavActions.tsx";

type NavBarProps = {
  hidden?: boolean;
};

function NavBar({ hidden = false }: NavBarProps) {
  const dispatch: AppDispatch = useDispatch();
  const brandText = useSelector(selectLogoText);

  useEffect(() => {
    validateToken(dispatch, getMemory(tokenField));
  }, []);

  const auth = useSelector(selectAuthenticated);

  useEffectAsync(async () => {
    if (!auth) return;

    const quotaTask = createCronJob(dispatch, refreshQuota, 30, true);
    const planTask = createCronJob(dispatch, refreshSubscription, 30, true);

    console.log(
      `[cron] register quota and plan fetching tasks: ${quotaTask}, ${planTask}`,
    );

    return () => clearCronJobs([quotaTask, planTask]);
  }, [auth]);

  if (hidden) return null;

  return (
    <nav className={`navbar`}>
      <div className={`items space-x-2`}>
        <Button
          size={`icon-md`}
          variant={`ghost`}
          className={`sidebar-button`}
          onClick={() => dispatch(toggleMenu())}
        >
          <Menu className={`w-5 h-5`} />
        </Button>
        <img
          className={`logo w-9 h-9 scale-110`}
          src={appLogo}
          alt=""
          onClick={() => router.navigate("/")}
        />
        {brandText.enabled && brandText.text && (
          <span
            className="logo-brand-text"
            style={{
              fontFamily: brandText.font,
              fontWeight: brandText.weight ?? 500,
              fontSize: `${brandText.size}px`,
              marginLeft:
                typeof brandText.margin === "number"
                  ? `${brandText.margin}px`
                  : undefined,
              letterSpacing: brandText.letter_spacing ? `${brandText.letter_spacing}px` : undefined,
              transform: brandText.vertical_offset ? `translateY(${brandText.vertical_offset}px)` : undefined,
              display: "inline-block",
            }}
            onClick={() => router.navigate("/")}
          >
            {brandText.text}
          </span>
        )}
        <div className={`grow`} />
        <NavActions />
      </div>
    </nav>
  );
}

export default NavBar;
