import { ThemeProvider } from "@/components/ThemeProvider.tsx";
import DialogManager from "@/dialogs";
import { useEffectAsync } from "@/utils/hook.ts";
import { bindMarket, getApiPlans } from "@/api/v1.ts";
import { useDispatch } from "react-redux";
import {
  stack,
  updateMasks,
  updateSupportModels,
  useMessageActions,
} from "@/store/chat.ts";
import { deleteConversation, updateConversationList } from "@/api/history.ts";
import { appendTargetText, setIsTranslating } from "@/store/translate.ts";

import { dispatchSubscriptionData, setTheme } from "@/store/globals.ts";
import { infoEvent } from "@/events/info.ts";
import { setForm } from "@/store/info.ts";
import { themeEvent } from "@/events/theme.ts";
import { useEffect, useRef } from "react";

function AppProvider({ children }: { children?: React.ReactNode }) {
  const dispatch = useDispatch();
  const { receive, receiveFollowUps } = useMessageActions();

  // Always keep a ref to the latest receive so the one-time setCallback closure
  // never goes stale (chatHistory captured at mount would be empty otherwise).
  const receiveRef = useRef(receive);
  receiveRef.current = receive;
  const receiveFollowUpsRef = useRef(receiveFollowUps);
  receiveFollowUpsRef.current = receiveFollowUps;

  useEffect(() => {
    infoEvent.bind((data) => dispatch(setForm(data)));
    themeEvent.bind((theme) => dispatch(setTheme(theme)));

    let translationConversationId: number | null = null;

    stack.setCallback(async (id, message) => {
      if (id === -1001) {
        if (message.conversation) {
          translationConversationId = message.conversation;
        }
        if (message.message) {
          dispatch(appendTargetText(message.message));
        }
        if (message.end) {
          dispatch(setIsTranslating(false));
          if (translationConversationId) {
            const target = translationConversationId;
            translationConversationId = null;
            
            console.debug(`[translate] cleaning up virtual conversation: ${target}`);
            deleteConversation(target).then((res) => {
               if (res) updateConversationList(dispatch);
            });
          }
        }
        return;
      }
      if (message.event === "follow_ups") {
        receiveFollowUpsRef.current(id, message);
        return;
      }
      await receiveRef.current(id, message);
    });

  }, []);

  useEffectAsync(async () => {
    updateSupportModels(dispatch, await bindMarket());
    dispatchSubscriptionData(dispatch, await getApiPlans());
    await updateMasks(dispatch);
  }, []);

  return (
    <ThemeProvider>
      <DialogManager />
      {children}
    </ThemeProvider>
  );
}

export default AppProvider;
