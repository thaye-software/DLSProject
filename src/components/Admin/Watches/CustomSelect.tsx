"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";

export default function CustomSelect({
  placeholderText,
  array,
  value,
  onValueChange,
}: {
  placeholderText: string;
  array: Array<{ id: string | number; name: string }>;
  value?: string;
  onValueChange?: (val: string) => void;
  }) {
  
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
