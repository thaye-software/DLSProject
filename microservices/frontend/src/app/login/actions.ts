"use server";

import { LoginSchema } from "./validation";

import { createClient } from "@/lib/supabase/server";






export type LoginFormState = {
  fieldErrors?: Partial<Record<"email" | "password", string>>;
  formError?: string;
  values?: {
    email?: string;
    password?: string;
    redirectUrl?: string
  };
  success?: boolean;
};

export async function login(
  _: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const supabase = await createClient();

  const redirectUrl = formData.get("redirectUrl")?.toString();

  const raw = {
    email: formData.get("email"),
    password: formData.get("password")
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

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if(error?.code === "email_not_confirmed") { // supabase error code
    await resendEmailConfirmation(email, supabase);
    error.message += ". The confirmation email has been resend.";
  }
 

  // If sign in failed, return immediately
  if (error) {
    return {
      formError: error.message,
      values: { email, password },
    };
  }

  return {
    success: true,
    values: { 
      email, 
      password, 
      redirectUrl: redirectUrl || "/", 
    },
  };
}

//---------------------------- helper functions ----------------------------

async function resendEmailConfirmation(recipientEmail: string, supabase: any): Promise<void> {
  const env = process.env.APP_ENV?.toLocaleLowerCase();

  const {error} = await supabase.auth.resend({
    type: "signup",
    email: recipientEmail,
    options: {
      emailRedirectTo: 
        env == "dev" ? "https://watches.thaulow.tech/" : env == "prod" ? "TODO impleent prod url" : "http://localhost:3000/"
    }
  });
  
  if(error) throw error;
}
