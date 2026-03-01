import { CustomMask } from "@/masks/types.ts";
import axios from "axios";
import { CommonResponse } from "@/api/common.ts";
import { getErrorMessage } from "@/utils/base.ts";

type ListMaskResponse = CommonResponse & {
  data: CustomMask[];
};

export async function listMasks(): Promise<ListMaskResponse> {
  try {
    const resp = await axios.get("/conversation/mask/view");
    return (
      resp.data ?? {
        status: true,
        data: [],
      }
    );
  } catch (e) {
    return {
      status: false,
      data: [],
      error: getErrorMessage(e),
    };
  }
}

export async function saveMask(mask: CustomMask): Promise<CommonResponse> {
  try {
    const resp = await axios.post("/conversation/mask/save", mask);
    return resp.data;
  } catch (e) {
    return {
      status: false,
      error: getErrorMessage(e),
    };
  }
}

export async function deleteMask(id: number): Promise<CommonResponse> {
  try {
    const resp = await axios.post("/conversation/mask/delete", { id });
    return resp.data;
  } catch (e) {
    return {
      status: false,
      error: getErrorMessage(e),
    };
  }
}

type UploadMaskAvatarResponse = CommonResponse & {
  url?: string;
};

export async function uploadMaskAvatar(file: File): Promise<UploadMaskAvatarResponse> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const resp = await axios.post("/conversation/mask/avatar/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return resp.data as UploadMaskAvatarResponse;
  } catch (e) {
    return {
      status: false,
      error: getErrorMessage(e),
    };
  }
}
