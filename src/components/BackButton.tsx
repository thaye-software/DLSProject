"use client"

import { Button } from "./ui/button";
import { ArrowLeft } from 'lucide-react';

export default function BackButton() {
    return(
        <Button onClick={() => window.history.back()} variant="ghost" className="hover:cursor-pointer">
            <ArrowLeft />
            Back
        </Button>
    );
}