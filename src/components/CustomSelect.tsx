import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import constants from "@/lib/constants";

export default function CustomSelect({ placeholderText, array }: { placeholderText: string; array: Array<{ id: number; name: string }> }) {
  const movementOptions = constants.MOVEMENT_OPTIONS;


  return (
    <Select>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholderText} />
      </SelectTrigger>
      <SelectContent>
        {array.map((item) => (
          <SelectItem key={item.id} value={item.name}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}