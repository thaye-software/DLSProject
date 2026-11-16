import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// shortcut: static list of shipping countries, replace when Orders exposes one.
export const COUNTRIES = [
  { code: "DK", name: "Denmark" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DE", name: "Germany" },
  { code: "NL", name: "Netherlands" },
  { code: "GB", name: "United Kingdom" },
];

// One address block; `prefix` namespaces the field names ("billing" or "delivery").
export default function BillingForm({ prefix, values = {} }: { prefix: string; values?: Record<string, string> }) {
  const f = (name: string) => `${prefix}_${name}`;
  const d = (name: string) => values[f(name)];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={f("first_name")}>First Name*</Label>
          <Input id={f("first_name")} name={f("first_name")} defaultValue={d("first_name")} placeholder="your first name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={f("middle_name")}>Middle Name (Optional)</Label>
          <Input id={f("middle_name")} name={f("middle_name")} defaultValue={d("middle_name")} placeholder="your middle name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={f("last_name")}>Last Name*</Label>
          <Input id={f("last_name")} name={f("last_name")} defaultValue={d("last_name")} placeholder="your last name" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={f("address_line_1")}>Street Address*</Label>
        <Input id={f("address_line_1")} name={f("address_line_1")} defaultValue={d("address_line_1")} placeholder="123 Main Street" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={f("address_line_2")}>Address line 2 (optional)</Label>
        <Input id={f("address_line_2")} name={f("address_line_2")} defaultValue={d("address_line_2")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={f("city")}>City*</Label>
          <Input id={f("city")} name={f("city")} defaultValue={d("city")} placeholder="Copenhagen" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={f("zip_code")}>Postal Code*</Label>
          <Input id={f("zip_code")} name={f("zip_code")} defaultValue={d("zip_code")} placeholder="2300" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={f("country_code")}>Country*</Label>
        <select
          id={f("country_code")}
          name={f("country_code")}
          required
          defaultValue={d("country_code") ?? "DK"}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={f("state_province")}>State Province (optional)</Label>
        <Input id={f("state_province")} name={f("state_province")} defaultValue={d("state_province")} placeholder="Hovedstaden" />
      </div>
    </div>
  );
}
