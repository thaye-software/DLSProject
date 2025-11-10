"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { sendEmail } from "@/app/contact/actions"
import { useState } from "react"
import { Spinner } from "../ui/spinner"


export const contactFormSchema = z.object({
  costumerName: z.string().nonempty("Your name is required"),
  costumerEmail: z.email().nonempty("Your email is required"),
  costumerPhoneNumber: z.string().optional(),
  
  costumerMessage: z
  .string()
  .min(1, "Message is required")
  .min(10, "Please write at least 10 characters")
  .max(1000, "Message is too long (max 1000 characters)")
})


export default function ContactForm() {
  
  const [isSuccess, setIsSuccess] = useState<boolean | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const form = useForm<z.infer<typeof contactFormSchema>>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      costumerName: "",
      costumerEmail: "",
      costumerPhoneNumber: "",
      costumerMessage: ""
    }
  })

  async function onSubmit(values: z.infer<typeof contactFormSchema>) {
    console.log(values)
    
    const sentSuccessfully = await sendEmail(values);
    if (!sentSuccessfully) {
      setIsSuccess(false);
      return;
    }

    form.reset();
    setIsSuccess(true);
    setIsLoading(false);
  }

  return (
    <div>
      {isSuccess === undefined ? (
      <div></div>
    ) : isSuccess ? (
      <h1 className="mb-12 text-green-600">Email sent successfully.</h1>
    ) : (
      <h1 className="mb-12 text-red-600">Email was unfortunatly not sent successfully, please try again later.</h1>
    )}
    
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Name and Email side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="costumerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-md">Name *</FormLabel>
                  <FormMessage />
                  <FormControl>
                    <Input placeholder="your name" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="costumerEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-md">Email *</FormLabel>
                  <FormMessage />
                  <FormControl>
                    <Input placeholder="your email" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* Phone full width */}
          <FormField
            control={form.control}
            name="costumerPhoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-md">Phone</FormLabel>
                <FormDescription>
                  Optionally add your phone number here
                </FormDescription>
                <FormControl>
                  <Input placeholder="your phone number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Message full width */}
          <FormField
            control={form.control}
            name="costumerMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-md">Message *</FormLabel>
                <FormMessage />
                <FormControl>
                  <Textarea 
                    placeholder="Enter your message here" 
                    className="min-h-[120px]"
                    {...field} 
                  />
                </FormControl>
              </FormItem>
            )}
          />


          {isLoading ? (
            <Button className="bg-slate-900" type="submit" disabled> <Spinner/> Submitting...</Button>
          ) : (
            <Button className="bg-slate-900 hover:cursor-pointer" type="submit">Submit</Button>
          )}
        </form>
      </Form>
    </div>
  )
}