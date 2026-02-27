import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { RootState } from "./index";

interface TimelineState {
  visible: boolean;
  activeMessageIndex: number;
  starredIndices: number[];
}

const timelineSlice = createSlice({
  name: "timeline",
  initialState: {
    visible: false,
    activeMessageIndex: 0,
    starredIndices: [],
  } as TimelineState,
  reducers: {
    toggleTimeline: (state) => {
      state.visible = !state.visible;
    },
    setTimelineVisible: (state, action: PayloadAction<boolean>) => {
      state.visible = action.payload;
    },
    setActiveMessageIndex: (state, action: PayloadAction<number>) => {
      state.activeMessageIndex = action.payload;
    },
    setStarredIndices: (state, action: PayloadAction<number[]>) => {
      state.starredIndices = action.payload;
    },
    addStarredIndex: (state, action: PayloadAction<number>) => {
      if (!state.starredIndices.includes(action.payload)) {
        state.starredIndices.push(action.payload);
      }
    },
    removeStarredIndex: (state, action: PayloadAction<number>) => {
      state.starredIndices = state.starredIndices.filter(
        (i) => i !== action.payload,
      );
    },
  },
});

export const {
  toggleTimeline,
  setTimelineVisible,
  setActiveMessageIndex,
  setStarredIndices,
  addStarredIndex,
  removeStarredIndex,
} = timelineSlice.actions;

export const useTimelineVisible = () =>
  useSelector((state: RootState) => state.timeline.visible);
export const useActiveMessageIndex = () =>
  useSelector((state: RootState) => state.timeline.activeMessageIndex);
export const useStarredIndices = () =>
  useSelector((state: RootState) => state.timeline.starredIndices);

export default timelineSlice.reducer;
