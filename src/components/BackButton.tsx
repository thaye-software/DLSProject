"use client"

import { Button } from "./ui/button";
import { ArrowLeft } from 'lucide-react';

export default function BackButton({addClassName}: {addClassName?: string}) {
    return(
        <Button onClick={() => window.history.back()} variant="ghost" className={`hover:cursor-pointer ${addClassName}`}>
            <ArrowLeft />
            Back
        </Button>
    );
}