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

import { register, type RegisterFormState } from "@/app/login/actions";
import { useActionState } from "react";

function toggleLoginState(
  isLogin: boolean,
  setIsLogin: (isLogin: boolean) => void
) {
  setIsLogin(!isLogin);
}

export function RegisterForm({
  isLogin,
  setIsLogin,
  className,
  ...props
}: React.ComponentProps<"form"> & {
  isLogin: boolean;
  setIsLogin: (isLogin: boolean) => void;
}) {
  const initialState: RegisterFormState = {};
  const [state, formAction] = useActionState(register, initialState);
  return (
    <form
      action={formAction}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Sign up for an account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email below to create a new account
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input
            name="username"
            id="username"
            type="text"
            required
            defaultValue={state?.values?.username || ""}
          />
          {state?.fieldErrors?.username && (
            <p className="text-sm text-destructive mt-1">
              {state.fieldErrors.username}
            </p>
          )}
        </Field>
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
          <Button type="submit">Sign Up</Button>
        </Field>
        <FieldSeparator />
        <Field>
          <FieldDescription className="text-center">
            <span>Already have an account? </span>
            <Button
              type="button"
              className="cursor-pointer"
              variant="link"
              onClick={() => toggleLoginState(isLogin, setIsLogin)}
            >
              Log in
            </Button>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
