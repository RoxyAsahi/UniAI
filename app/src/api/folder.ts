import axios from "axios";

export interface Folder {
  id: number;
  name: string;
  color: string;
  avatar?: string;
  parent_id: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

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
  parentId?: number,
): Promise<Folder | null> {
  try {
    const resp = await axios.post("/conversation/folder", {
      name,
      color: color || "",
      avatar: avatar || null,
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
): Promise<boolean> {
  try {
    const resp = await axios.post("/conversation/folder/update", {
      id,
      name,
      color: color || "",
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
