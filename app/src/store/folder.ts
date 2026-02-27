import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { RootState } from "./index";
import { Folder } from "@/api/folder";

interface FolderState {
  folders: Folder[];
  loading: boolean;
  dragOverFolderId: number | null;
}

const folderSlice = createSlice({
  name: "folder",
  initialState: {
    folders: [],
    loading: false,
    dragOverFolderId: null,
  } as FolderState,
  reducers: {
    setFolders: (state, action: PayloadAction<Folder[]>) => {
      state.folders = action.payload;
    },
    setFolderLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    addFolder: (state, action: PayloadAction<Folder>) => {
      state.folders.push(action.payload);
    },
    updateFolderInStore: (state, action: PayloadAction<Folder>) => {
      const idx = state.folders.findIndex((f) => f.id === action.payload.id);
      if (idx !== -1) state.folders[idx] = action.payload;
    },
    removeFolder: (state, action: PayloadAction<number>) => {
      state.folders = state.folders.filter((f) => f.id !== action.payload);
    },
    setDragOverFolder: (state, action: PayloadAction<number | null>) => {
      state.dragOverFolderId = action.payload;
    },
  },
});

export const {
  setFolders,
  setFolderLoading,
  addFolder,
  updateFolderInStore,
  removeFolder,
  setDragOverFolder,
} = folderSlice.actions;

export const useFolders = () =>
  useSelector((state: RootState) => state.folder.folders);
export const useFolderLoading = () =>
  useSelector((state: RootState) => state.folder.loading);
export const useDragOverFolderId = () =>
  useSelector((state: RootState) => state.folder.dragOverFolderId);

export default folderSlice.reducer;
