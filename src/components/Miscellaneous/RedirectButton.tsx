"use client";

import { redirect } from "next/navigation";

import { Button } from "../ui/button";



export default function RedirectButton({targetPage, buttonText}: {targetPage: string, buttonText: string}) {
    return (
        <Button
            onClick={() => redirect(targetPage)}
            size="lg"
            className="cursor-pointer font-bold"
        >
            {buttonText}
        </Button>
    )
}