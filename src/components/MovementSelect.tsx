import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import constants from "@/lib/constants";

export default function MovementSelect() {
  const movementOptions = constants.MOVEMENT_OPTIONS;

  return (
    <Select>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a movement" />
      </SelectTrigger>
      <SelectContent>
        {movementOptions.map((movement) => (
          <SelectItem key={movement.id} value={movement.name}>
            {movement.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}