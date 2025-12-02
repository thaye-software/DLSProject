import { Mail, Phone, Clock, Calendar } from "lucide-react";

import ContactForm from "@/components/Contact/ContactForm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="container mx-auto px-4 mt-12">
        <h1 className="text-4xl font-serif mb-3">Contact Us</h1>
        <p className="dark:text-slate-300 text-lg">
          We take pride in offering personalized assistance to help you select
          and care for your distinguished timepiece.
        </p>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Form - Takes 2 columns */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-serif">
                  Send Us a Message
                </CardTitle>
                <CardDescription>
                  We respond within 1-3 business days. Labels marked with * are
                  required.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContactForm />
              </CardContent>
            </Card>
          </div>

          {/* Contact Information Sidebar */}
          <div className="space-y-6">
            {/* Phone Support Hours */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <CardTitle className="text-lg">Phone Support Hours</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Monday - Friday</span>
                    <span className="font-medium">10:00 - 19:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday</span>
                    <span className="font-medium">11:00 - 18:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sunday</span>
                    <span className="font-medium">Closed</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Get In Touch</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <div className="flex items-start">
                    <Phone className="w-5 h-5 mr-3 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      
                      <a  href="tel:+4512345678"
                        className="text-muted-foreground hover:text-foreground transition text-sm"
                      >
                        +45 26 46 95 96
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <Mail className="w-5 h-5 mr-3 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <a
                        href="mailto:contact@luxurywatches.com"
                        className="text-muted-foreground hover:text-foreground transition text-sm"
                      >
                        contact@limitedwatches.com
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}