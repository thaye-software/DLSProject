import { useFormStatus } from "react-dom";
import { Button } from "../../ui/button";
import { Spinner } from "../../ui/spinner";

export default function ExchangeRateSubmitButton() {
  const { pending } = useFormStatus();

  return <Button type="submit" className="w-24" disabled={pending}>{pending ? <span><Spinner /></span> : "Update"}</Button>;
}