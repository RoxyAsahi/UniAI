import axios from "axios";
import { ConversationInstance } from "@/api/types.tsx";

export interface Folder {
  id: number;
  name: string;
  color?: string;
  avatar?: string;
  background?: string;
  parent_id: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type FolderExportData = {
  folder: Folder;
  conversations: ConversationInstance[];
  exported_at: string;
};

export async function listFolders(): Promise<Folder[]> {
  try {
    const resp = await axios.get("/conversation/folders");
    return resp.data.status ? resp.data.data || [] : [];
  } catch (e) {
    console.warn(e);
    return [];
  }
}

export async function createFolder(
  name: string,
  color?: string,
  avatar?: string,
  background?: string,
  parentId?: number,
): Promise<Folder | null> {
  try {
    const resp = await axios.post("/conversation/folder", {
      name,
      color: color || "",
      avatar: avatar || null,
      background: background || null,
      parent_id: parentId || null,
    });
    return resp.data.status ? resp.data.data : null;
  } catch (e) {
    console.warn(e);
    return null;
  }
}

export async function updateFolder(
  id: number,
  name: string,
  color?: string,
  avatar?: string,
  background?: string,
): Promise<boolean> {
  try {
    const resp = await axios.post("/conversation/folder/update", {
      id,
      name,
      color: color || "",
      avatar: avatar || null,
      background: background || null,
    });
    return resp.data.status;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

export async function deleteFolder(id: number): Promise<boolean> {
  try {
    const resp = await axios.get(`/conversation/folder/delete?id=${id}`);
    return resp.data.status;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

export async function reorderFolders(
  orders: { id: number; sort_order: number }[],
): Promise<boolean> {
  try {
    const resp = await axios.post("/conversation/folder/reorder", { orders });
    return resp.data.status;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

export async function moveConversation(
  conversationId: number,
  folderId: number | null,
): Promise<boolean> {
  try {
    const resp = await axios.post("/conversation/move", {
      conversation_id: conversationId,
      folder_id: folderId,
    });
    return resp.data.status;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

export async function reorderConversations(
  orders: Record<number, number>,
): Promise<boolean> {
  try {
    const resp = await axios.post("/conversation/reorder", { orders });
    return resp.data.status;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

export async function exportFolder(
  id: number,
): Promise<FolderExportData | null> {
  try {
    const resp = await axios.get(`/conversation/folder/export?id=${id}`);
    return resp.data.status ? resp.data.data : null;
  } catch (e) {
    console.warn(e);
    return null;
  }
}
