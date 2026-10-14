"use client"

import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { ArrowLeft } from 'lucide-react';

export default function BackButton({addClassName, redirectUrl}: {addClassName?: string, redirectUrl?: string}) {
    
    const router = useRouter();

    function handleGoBack() {
        if(redirectUrl) {
            router.push(redirectUrl);
            return;
        }

        window.history.back();
    }



    return(
        <Button onClick={handleGoBack} variant="ghost" className={`hover:cursor-pointer ${addClassName}`}>
            <ArrowLeft />
            Back
        </Button>
    );
}