import { useState, useEffect } from "react";
import { cn } from "@/lib/tailwindUtils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "../ui/spinner";

import { login, type LoginFormState } from "@/app/login/actions";
import { useActionState } from "react";
import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";

function toggleLoginState(
  isLogin: boolean,
  setIsLogin: (isLogin: boolean) => void
) {
  setIsLogin(!isLogin);
}

export function LoginForm({
  isLogin,
  setIsLogin,
  redirectUrl,
  className,
  ...props
}: React.ComponentProps<"form"> & {
  isLogin: boolean;
  setIsLogin: (isLogin: boolean) => void;
  redirectUrl?: string;
}) {
  const initialState: LoginFormState = {};
  const [state, formAction] = useActionState(login, initialState);
  const [loading, setLoading] = useState(false);

  const { refreshUser } = useSupabaseAuthContext();

  useEffect(() => {
    if (state.formError || state.fieldErrors) {
      setLoading(false);
    }
    
    if (state?.success) {
      // Refresh user data first
      // whenever the action state changes, stop the loading spinner
      // this covers success and error cases (server returned)
      refreshUser().then(() => {
        // Then redirect after a brief moment to ensure state has updated
        setTimeout(() => {
          window.location.href = state.values?.redirectUrl as string;
        }, 100);
      });
      setLoading(false);
    }
  }, [state?.success, state?.formError, state.fieldErrors, state?.values?.redirectUrl, refreshUser]);

  return (
    <form
      action={formAction}
      onSubmit={() => setLoading(true)}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email below to login to your account
          </p>
        </div>
        
        {redirectUrl && (
          <input type="hidden" name="redirectUrl" value={redirectUrl} />
        )}
        
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            name="email"
            id="email"
            type="email"
            placeholder="m@example.com"
            required
            disabled={loading}
            defaultValue={state?.values?.email || ""}
          />
          {state?.fieldErrors?.email && (
            <p className="text-sm text-destructive mt-1">
              {state.fieldErrors.email}
            </p>
          )}
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <a
              href="/login/forgot-password"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </a>
          </div>
          <Input
            name="password"
            id="password"
            type="password"
            placeholder="********"
            required
            disabled={loading}
            defaultValue={state?.values?.password || ""}
          />
          {state?.fieldErrors?.password && (
            <p className="text-sm text-destructive mt-1">
              {state.fieldErrors.password}
            </p>
          )}
        </Field>
        {state?.formError && (
          <p className="text-sm text-destructive">{state.formError}</p>
        )}
        <Field>
          <Button type="submit" disabled={loading} aria-busy={loading}>
            {loading ? <>Loading... <Spinner /></> : "Login"}
          </Button>
        </Field>
        <FieldSeparator />
        <Field>
          <FieldDescription className="text-center">
            <span>Don't have an account? </span>
            <Button
              type="button"
              variant="link"
              onClick={() => toggleLoginState(isLogin, setIsLogin)}
            >
              Sign up
            </Button>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}