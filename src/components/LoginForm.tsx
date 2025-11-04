import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { login, type LoginFormState } from "@/app/auth/[login]/actions";
import { useActionState } from "react";

function toggleLoginState(
  isLogin: boolean,
  setIsLogin: (isLogin: boolean) => void
) {
  setIsLogin(!isLogin);
}

export function LoginForm({
  isLogin,
  setIsLogin,
  className,
  ...props
}: React.ComponentProps<"form"> & {
  isLogin: boolean;
  setIsLogin: (isLogin: boolean) => void;
}) {
  const initialState: LoginFormState = {};
  const [state, formAction] = useActionState(login, initialState);
  return (
    <form
      action={formAction}
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
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            name="email"
            id="email"
            type="email"
            placeholder="m@example.com"
            required
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
              href="#"
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
          <Button type="submit">Login</Button>
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
