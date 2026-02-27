import axios from "axios";

export interface StarredMessage {
  conversation_id: number;
  message_index: number;
  created_at: string;
}

export async function starMessage(
  conversationId: number,
  messageIndex: number,
): Promise<boolean> {
  try {
    const resp = await axios.post("/conversation/star", {
      conversation_id: conversationId,
      message_index: messageIndex,
    });
    return resp.data.status;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

export async function unstarMessage(
  conversationId: number,
  messageIndex: number,
): Promise<boolean> {
  try {
    const resp = await axios.post("/conversation/unstar", {
      conversation_id: conversationId,
      message_index: messageIndex,
    });
    return resp.data.status;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

export async function getStarredMessages(
  conversationId: number,
): Promise<StarredMessage[]> {
  try {
    const resp = await axios.get(
      `/conversation/starred?conversation_id=${conversationId}`,
    );
    return resp.data.status ? resp.data.data || [] : [];
  } catch (e) {
    console.warn(e);
    return [];
  }
}
