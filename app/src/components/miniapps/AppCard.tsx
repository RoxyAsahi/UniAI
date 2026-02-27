import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MiniApp } from "./apps.ts";
import { openWindow } from "@/utils/device.ts";

type AppCardProps = {
  app: MiniApp;
};

function AppCard({ app }: AppCardProps) {
  const [imgError, setImgError] = useState(false);
  const navigate = useNavigate();

  const handleClick = () => {
    if (app.route) {
      navigate(app.route);
    } else {
      openWindow(app.url, "_blank");
    }
  };

  const isEmoji = app.icon.length <= 2 && /\p{Emoji}/u.test(app.icon);

  return (
    <div className="miniapp-card" onClick={handleClick} title={app.name}>
      <div className="miniapp-icon-wrapper">
        {isEmoji ? (
          <div className="miniapp-icon-emoji">{app.icon}</div>
        ) : !imgError ? (
          <img
            src={app.icon}
            alt={app.name}
            className="miniapp-icon"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="miniapp-icon-fallback">
            {app.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <span className="miniapp-name">{app.name}</span>
    </div>
  );
}

export default AppCard;
