import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import constants from "@/lib/constants";

export default function CustomSelect({
  placeholderText,
  array,
  value,
  onValueChange,
}: {
  placeholderText: string;
  array: Array<{ id: number; name: string }>;
  value?: string;
  onValueChange?: (val: string) => void;
}) {
  const movementOptions = constants.MOVEMENT_OPTIONS;

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholderText} />
      </SelectTrigger>
      <SelectContent>
        {array.map((item) => (
          <SelectItem key={item.id} value={item.id.toString()}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
