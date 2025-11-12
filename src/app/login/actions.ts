"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/database/supabase/server";
import { RegisterSchema, LoginSchema } from "./validation";
import { userService } from "@/services/userService";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export type RegisterFormState = {
  fieldErrors?: Partial<Record<"username" | "email" | "password", string>>;
  formError?: string;
  values?: {
    username?: string;
    email?: string;
    password?: string;
  };
  success?: boolean;
};

export type LoginFormState = {
  fieldErrors?: Partial<Record<"email" | "password", string>>;
  formError?: string;
  values?: {
    email?: string;
    password?: string;
  };
  success?: boolean;
};

export async function login(
  _: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const supabase = await createClient();

  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        email: flat.email?.[0],
        password: flat.password?.[0],
      },
      values: {
        email: typeof raw.email === "string" ? raw.email : "",
        password: typeof raw.password === "string" ? raw.password : "",
      },
    };
  }

  const { email, password } = parsed.data;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // If sign in failed, return immediately
  if (error) {
    return {
      formError: error.message,
      values: { email, password },
    };
  }

  // On successful sign in, fetch avatar by email from the users table.
  // Use the absolute baseUrl because this code runs on the server.
  try {
    const res = await fetch(
      `${baseUrl}/api/users/avatar?email=${encodeURIComponent(email)}`
    );

    if (res.ok) {
      const { avatarUrl } = await res.json();
      // Note: this is server-side code; localStorage is not available here.
      // If you want the client to have the avatar immediately, either:
      // - store it in a cookie (via next/headers cookies()),
      // - or return it to the client and let the client set localStorage,
      // - or let the client fetch it after redirect via the hook.
      // For now we don't persist it server-side — the value is fetched to ensure it exists.
      console.log("avatarUrl (server):", avatarUrl);
    }
  } catch (fetchErr) {
    // ignore avatar fetch failures — don't block sign-in
    console.error("Failed to fetch avatar:", fetchErr);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function register(
  _: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  const supabase = await createClient();

  // Extract raw values
  const raw = {
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
  };

  // Validate with Zod
  const parsed = RegisterSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        username: flat.username?.[0],
        email: flat.email?.[0],
        password: flat.password?.[0],
      },
      values: {
        username: typeof raw.username === "string" ? raw.username : "",
        email: typeof raw.email === "string" ? raw.email : "",
        password: typeof raw.password === "string" ? raw.password : "",
      },
    };
  }

  const { username, email, password } = parsed.data;

  // Create Supabase auth user
  const response = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: username } },
  });

  console.log("supabase auth response:",response);

  if (response.error) {
    return { formError: response.error.message };
  }

  const newUser = {
    id: response.data.user?.id!,
    username,
    email,
    role: "customer",
  }

  const createUserResponse = await userService.createUser(newUser)

  // // Create application user first
  // const createUserResponse = await fetch(`${baseUrl}/api/users`, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({ username, email, password }),
  // });

  if (!createUserResponse.success) {
    let errorMsg = "Failed to create user";
    try {
      const res = await createUserResponse;
      errorMsg = res.error || errorMsg;
    } catch {}
    return { formError: errorMsg };
  }

  return { success: true };
  // // Success: redirect to home
  // revalidatePath("/", "layout");
  // redirect("/");
}
