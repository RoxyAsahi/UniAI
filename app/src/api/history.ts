import axios from "axios";
import type { ConversationInstance } from "./types.tsx";
import { setHistory } from "@/store/chat.ts";
import { AppDispatch } from "@/store";
import { CommonResponse } from "@/api/common.ts";
import { getErrorMessage } from "@/utils/base.ts";
import { VirtualWebSearchRole, VirtualRolePrefix, Message } from "./types.tsx";
import { formatToolCallResult } from "@/api/plugin.ts";

export type ConversationListPage = {
  items: ConversationInstance[];
  hasMore: boolean;
  offset: number;
  limit: number;
};

type ConversationListQuery = {
  offset?: number;
  limit?: number;
};

export async function getConversationListPage(
  query: ConversationListQuery = {},
): Promise<ConversationListPage> {
  const offset = Math.max(0, query.offset ?? 0);
  const limit = Math.max(1, query.limit ?? 100);

  try {
    const resp = await axios.get("/conversation/list", {
      params: { offset, limit },
    });

    const data = resp.data;
    const items = (
      data?.status ? (Array.isArray(data.data) ? data.data : data.data?.items || []) : []
    ) as ConversationInstance[];
    const hasMore =
      typeof data?.has_more === "boolean"
        ? data.has_more
        : typeof data?.data?.has_more === "boolean"
          ? data.data.has_more
          : items.length >= limit;

    return {
      items,
      hasMore,
      offset,
      limit,
    };
  } catch (e) {
    console.warn(e);
    return {
      items: [],
      hasMore: false,
      offset,
      limit,
    };
  }
}

export async function getConversationList(): Promise<ConversationInstance[]> {
  const page = await getConversationListPage();
  return page.items;
}

export async function updateConversationList(
  dispatch: AppDispatch,
): Promise<void> {
  const page = await getConversationListPage();
  dispatch(setHistory(page.items));
}

export async function loadConversation(
  id: number,
): Promise<ConversationInstance> {
  try {
    const resp = await axios.get(`/conversation/load?id=${id}`);
    
    if (resp.data.status) {
      const conversation = resp.data.data as ConversationInstance;

      if (conversation.message && conversation.message.length > 0) {
        const processedMessages: Message[] = [];
        
        for (let i = 0; i < conversation.message.length; i++) {
          const currentMsg = conversation.message[i];
          

          if (currentMsg.role === VirtualWebSearchRole) {

            let nextMsgIndex = i + 1;
            while (
              nextMsgIndex < conversation.message.length && 
              conversation.message[nextMsgIndex].role.startsWith(VirtualRolePrefix)
            ) {
              nextMsgIndex++;
            }
            

            if (nextMsgIndex < conversation.message.length) {

              conversation.message[nextMsgIndex].search_query = currentMsg.search_query;
              conversation.message[nextMsgIndex].search_result = currentMsg.search_result;
              conversation.message[nextMsgIndex].search_index = currentMsg.search_index;
            }
            

            continue;
          }
          
          if (currentMsg.role === "assistant" && currentMsg.tool_calls) {
            processedMessages.push(currentMsg);
          } else if (currentMsg.role === "tool" && currentMsg.tool_call_id) {
            const toolCallId = currentMsg.tool_call_id;
            for (let j = processedMessages.length - 1; j >= 0; j--) {
              const prevMsg = processedMessages[j];
              if (prevMsg.role === "assistant" && prevMsg.tool_calls) {
                const toolCall = prevMsg.tool_calls.find(tc => tc.id === toolCallId);
                if (toolCall) {
                  try {
                    const result = JSON.parse(currentMsg.content);
                    if (result.error) {
                      toolCall.error = result.error;
                      toolCall.status = "error";
                    } else {
                      const formattedResult = formatToolCallResult(currentMsg.content);
                      toolCall.result = formattedResult;
                      toolCall.status = "success";
                    }
                  } catch {
                    const formattedResult = formatToolCallResult(currentMsg.content);
                    toolCall.result = formattedResult;
                    toolCall.status = "success";
                  }
                }
                break;
              }
            }
            processedMessages.push(currentMsg);
          } else {
            processedMessages.push(currentMsg);
          }
        }
        

        conversation.message = processedMessages;
      }
      
      return conversation;
    }
    return { id, name: "", message: [] };
  } catch (e) {
    console.warn(e);
    return { id, name: "", message: [] };
  }
}

export async function deleteConversation(id: number): Promise<boolean> {
  try {
    const resp = await axios.get(`/conversation/delete?id=${id}`);
    return resp.data.status;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

export async function renameConversation(
  id: number,
  name: string,
): Promise<CommonResponse> {
  try {
    const resp = await axios.post("/conversation/rename", { id, name });
    return resp.data as CommonResponse;
  } catch (e) {
    console.warn(e);
    return { status: false, error: getErrorMessage(e) };
  }
}

export async function cloneConversation(id: number): Promise<CommonResponse> {
  try {
    const resp = await axios.post("/conversation/clone", { id });
    return resp.data as CommonResponse;
  } catch (e) {
    console.warn(e);
    return { status: false, error: getErrorMessage(e) };
  }
}

export async function pinConversation(
  id: number,
  pinned: boolean,
): Promise<CommonResponse> {
  try {
    const resp = await axios.post("/conversation/pin", { id, pinned });
    return resp.data as CommonResponse;
  } catch (e) {
    console.warn(e);
    return { status: false, error: getErrorMessage(e) };
  }
}

export async function archiveConversation(
  id: number,
  archived: boolean,
): Promise<CommonResponse> {
  try {
    const resp = await axios.post("/conversation/archive", { id, archived });
    return resp.data as CommonResponse;
  } catch (e) {
    console.warn(e);
    return { status: false, error: getErrorMessage(e) };
  }
}

export async function deleteAllConversations(): Promise<boolean> {
  try {
    const resp = await axios.get("/conversation/clean");
    return resp.data.status;
  } catch (e) {
    console.warn(e);
    return false;
  }
}
