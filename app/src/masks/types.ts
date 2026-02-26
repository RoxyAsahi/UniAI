import { UserRole } from "@/api/types.tsx";

export type MaskMessage = {
  role: string;
  content: string;
};

export type Mask = {
  avatar: string;
  name: string;
  description?: string;
  tags?: string[];
  lang?: string;
  builtin?: boolean;
  context: MaskMessage[];
};

export type MaskModelSettings = {
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  history?: number;
  stream?: boolean;
};

export type CustomMask = Mask & MaskModelSettings & {
  id: number;
};

export const initialCustomMask: CustomMask = {
  id: -1,
  avatar: "1f9d0",
  name: "",
  context: [{ role: UserRole, content: "" }],
};
