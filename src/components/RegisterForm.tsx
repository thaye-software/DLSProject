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
  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Sign up for an account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email below to create a new account
          </p>
        </div>
        
        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input id="username" type="text" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" placeholder="m@example.com" required />
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
            id="password"
            type="password"
            placeholder="********"
            required
          />
        </Field>
        <Field>
          <Button type="submit">Login</Button>
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
