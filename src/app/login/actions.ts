"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/database/supabase/server";
import { RegisterSchema, LoginSchema } from "./validation";

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

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      formError: error.message,
      values: { email, password },
    };
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

  // Create application user first
  const createUserResponse = await fetch(`${baseUrl}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, email, password }),
  });

  if (!createUserResponse.ok) {
    let errorMsg = "Failed to create user";
    try {
      const res = await createUserResponse.json();
      errorMsg = res.error || errorMsg;
    } catch {}
    return { formError: errorMsg };
  }

  // Create Supabase auth user
  const response = await supabase.auth.signUp({ email, password, options: { data: { display_name: username } } });

  if (response.error) {
    return { formError: response.error.message };
  }

  // Success: redirect to home
  revalidatePath("/", "layout");
  redirect("/");
}
