"use client"

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";

import { saveAvatarUrlAction } from "@/app/settings/actions";

import { createClient } from "@/lib/supabase/client";






export default function ChangeAvatar() {
    
    const supabase = createClient();
    
    const [isLoading, setIsLoading] = useState<boolean>(false);    

    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    
    const { user, avatarUrl, refreshUser } = useSupabaseAuthContext();

    useEffect(()=>{
        setAvatarPreview(avatarUrl);
    }, [avatarUrl, user])

    
    
    async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
        const allowedFileTypes = ["jpg", "jpeg", "png"];
        
        const file = event.target.files?.[0];
        if (!file) {
            toast.error("No suitable files found");
            return;
        }
        
        const fileExtension = file.name.split(".").pop();
        const isAllowedFileType = allowedFileTypes.includes(fileExtension as string);
        if(!isAllowedFileType) {
            toast.error("File type of " + fileExtension + " is not supported");
            return;
        }
        
        // should we set preview or nah? if we set preview, the sync will lag behind in navbar 
        // setAvatarPreview(URL.createObjectURL(file));

        try {
            setIsLoading(true);
            const fileName = `${user?.id}.${fileExtension}`;
            
            const { error } = await supabase.storage
            .from("avatars")
            .upload(fileName, file, {
                cacheControl: "3600", // 1 hour cached in browser no need to download.
                upsert: true
            });

            if (error) {
                console.error("Upload error:", error);
                toast.error("Failed to upload avatar");
                return;
            }

            const { data: { publicUrl } } = supabase.storage
                .from("avatars")
                .getPublicUrl(fileName);
            
            // supabase dashboard caches the image so when you upload new image with same name as old one even though you upload new image, you see the same old iamge.... amazing    
            // this however fixes ui for website
            const cacheBustedUrl = `${publicUrl}?updated=${Date.now()}`;

            //@ts-ignore
            const success = await saveAvatarUrlAction(user.id as string, cacheBustedUrl);
            if(!success) {
                toast.error("Failed to save avatar")
            };
            
            await refreshUser();
            toast.success("Avatar updated!");
            
        } catch (error: any) {
            toast.error(error.message)

        } finally{
            setIsLoading(false);
        }

    }


    return(
        <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
                <AvatarImage src={avatarPreview || "https://github.com/shadcn.png"} />
                <AvatarFallback>PD</AvatarFallback>
            </Avatar>

            <div className="space-y-2">
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent transition-colors">
                        
                        {isLoading ? (
                            <div className="flex gap-2">
                                <span className="text-sm font-medium">Uploading avatar...</span>
                                <Spinner className="h-4 w-4" />
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Upload className="h-4 w-4" />
                                <span className="text-sm font-medium">Change Avatar/Profile picure</span>
                            </div>
                        )}
                    </div>

                    <Input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                        disabled={isLoading}
                    />
                </Label>
                <p className="text-xs text-muted-foreground">JPG, JPEG, PNG. Max size 50MB.</p>
            </div>
        </div>
    )
}
