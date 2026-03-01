import axios from "axios";
import { getErrorMessage } from "@/utils/base.ts";
import { isEmailValid } from "@/utils/form.ts";
import { toast } from "sonner";
import { CommonResponse } from "@/api/common.ts";

export type LoginForm = {
  username: string;
  password: string;
};

export type DeepLoginForm = {
  token: string;
};

export type LoginResponse = {
  status: boolean;
  error: string;
  token: string;
};

export type StateResponse = {
  status: boolean;
  user: string;
  admin: boolean;
};

export type RegisterForm = {
  username: string;
  password: string;
  repassword: string;
  email: string;
  code: string;
};

export type RegisterResponse = {
  status: boolean;
  error: string;
  token: string;
};

export type VerifyForm = {
  email: string;
};

export type VerifyResponse = {
  status: boolean;
  error: string;
};

export type ResetForm = {
  email: string;
  code: string;
  password: string;
  repassword: string;
};

export type ResetResponse = {
  status: boolean;
  error: string;
};

export type UserInfo = {
  id: number;
  register_days: number;
  used_quota: number;
  plan_total_month: number;
  email: string;
};

export type UserInfoResponse = {
  status: boolean;
  error: string;
  data: UserInfo;
};

export async function doLogin(
  data: DeepLoginForm | LoginForm,
): Promise<LoginResponse> {
  const response = await axios.post("/login", data);
  return response.data as LoginResponse;
}

export async function doState(): Promise<StateResponse> {
  const response = await axios.post("/state");
  return response.data as StateResponse;
}

export async function doRegister(
  data: RegisterForm,
): Promise<RegisterResponse> {
  try {
    const response = await axios.post("/register", data);
    return response.data as RegisterResponse;
  } catch (e) {
    return {
      status: false,
      error: getErrorMessage(e),
      token: "",
    };
  }
}

export async function doVerify(
  email: string,
  checkout?: boolean,
): Promise<VerifyResponse> {
  try {
    const response = await axios.post("/verify", {
      email,
      checkout,
    } as VerifyForm);
    return response.data as VerifyResponse;
  } catch (e) {
    return {
      status: false,
      error: getErrorMessage(e),
    };
  }
}

export async function doReset(data: ResetForm): Promise<ResetResponse> {
  try {
    const response = await axios.post("/reset", data);
    return response.data as ResetResponse;
  } catch (e) {
    return {
      status: false,
      error: getErrorMessage(e),
    };
  }
}

export async function sendCode(
  t: any,
  email: string,
  checkout?: boolean,
): Promise<boolean> {
  if (email.trim().length === 0 || !isEmailValid(email)) return false;

  const res = await doVerify(email, checkout);
  if (!res.status)
    toast.error(t("auth.send-code-failed"), {
      description: t("auth.send-code-failed-prompt", { reason: res.error }),
    });
  else
    toast.info(t("auth.send-code-success"), {
      description: t("auth.send-code-success-prompt"),
    });

  return res.status;
}

export const initialUserInfo: UserInfo = {
  id: 0,
  register_days: 0,
  used_quota: 0,
  plan_total_month: 0,
  email: "",
};

export type UserSettings = {
  auto_title: boolean;
  auto_model: string;
  auto_follow_up: boolean;
  follow_up_model: string;
  insert_follow_up_prompt: boolean;
  keep_follow_up_prompts: boolean;
};

export type UserSettingsResponse = {
  status: boolean;
  data: UserSettings;
};

export async function getUserSettings(): Promise<UserSettingsResponse> {
  try {
    const response = await axios.get("/user/settings");
    return response.data as UserSettingsResponse;
  } catch (e) {
    return {
      status: false,
      data: {
        auto_title: true,
        auto_model: "",
        auto_follow_up: true,
        follow_up_model: "",
        insert_follow_up_prompt: false,
        keep_follow_up_prompts: false,
      },
    };
  }
}

export async function saveUserSettings(
  data: UserSettings,
): Promise<CommonResponse> {
  try {
    const response = await axios.post("/user/settings", data);
    return response.data as CommonResponse;
  } catch (e) {
    return {
      status: false,
      error: getErrorMessage(e),
    };
  }
}

export async function getUserInfo(): Promise<UserInfoResponse> {
  try {
    const response = await axios.get("/userinfo");
    return response.data as UserInfoResponse;
  } catch (e) {
    return {
      status: false,
      error: getErrorMessage(e),
      data: { ...initialUserInfo },
    };
  }
}
