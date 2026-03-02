export const MAIN_LIST_DND_ID = "conversation-list";
export const FOLDER_DND_PREFIX = "folder-";
export const CONVERSATION_DND_PREFIX = "conv-";

export function toFolderDndId(folderId: number): string {
  return `${FOLDER_DND_PREFIX}${folderId}`;
}

export function parseFolderDndId(id: string): number | null {
  if (!id.startsWith(FOLDER_DND_PREFIX)) return null;
  const raw = Number(id.slice(FOLDER_DND_PREFIX.length));
  return Number.isFinite(raw) ? raw : null;
}

export function isFolderDndId(id: string): boolean {
  return parseFolderDndId(id) !== null;
}

export function toConversationDndId(conversationId: number): string {
  return `${CONVERSATION_DND_PREFIX}${conversationId}`;
}

export function parseConversationDndId(id: string): number | null {
  if (!id.startsWith(CONVERSATION_DND_PREFIX)) return null;
  const raw = Number(id.slice(CONVERSATION_DND_PREFIX.length));
  return Number.isFinite(raw) ? raw : null;
}

export function isConversationDndId(id: string): boolean {
  return parseConversationDndId(id) !== null;
}
