import { Mail, Phone, Clock, Calendar } from "lucide-react";

import ContactForm  from "@/components/contact/ContactForm"
import { Button } from "@/components/ui/button";



export default function ContactPage() {


  return (
    <div className="min-h-screen bg-[#F5F3EE] dark:bg-stone-800">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 mt-12">
        <h1 className="text-4xl font-serif mb-3">Contact Us</h1>
        <p className="dark:text-slate-300 text-lg">We take pride in offering personalized assistance to help you select and care for your distinguished timepiece.</p>
      </div>


      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Contact Form - Takes 2 columns */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <h2 className="text-2xl font-serif text-slate-900">Send Us a Message</h2>
              <p className="text-sm text-gray-600 dark:text-zinc-300">We respond within 1-3 bussines days.</p>
              <p className="text-sm text-gray-600 dark:text-zinc-300 mb-6">Labels marked with * are required.</p>
              
              <div>
                <ContactForm />
              </div>
            </div>
          </div>

          {/* Contact Information Sidebar */}
          <div className="space-y-6">
            
            {/* Phone Support Hours */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center mb-4">
                <Clock className="w-5 h-5 text-slate-900 mr-2" />
                <h3 className="text-lg font-semibold text-slate-900">Phone Support Hours</h3>
              </div>
              <div className="space-y-2 text-sm text-slate-600">
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
            </div>

            {/* Contact Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Get In Touch</h3>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <Phone className="w-5 h-5 text-slate-900 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Phone</p>
                    <a href="tel:+12125551234" className="text-slate-600 hover:text-slate-900 transition">
                      +45 12 34 56 78 
                    </a>
                  </div>
                </div>

                <div className="flex items-start">
                  <Mail className="w-5 h-5 text-slate-900 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Email</p>
                    <a href="mailto:contact@luxurywatches.com" className="text-slate-600 hover:text-slate-900 transition">
                      contact@luxurywatches.com
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Book Appointment */}
            <div className="bg-slate-900 text-white rounded-lg shadow-sm p-6">
              <div className="flex items-center mb-3">
                <Calendar className="w-5 h-5 mr-2" />
                <h3 className="text-lg font-semibold">Private Viewing</h3>
              </div>
              <p className="text-slate-300 text-sm mb-4">
                Schedule a personal appointment to experience our timepieces in person.
              </p>
              <Button className="w-full bg-white text-slate-900 py-3 rounded-md font-medium hover:bg-slate-100 transition cursor-pointer">
                Book Appointment (to be implemented)
              </Button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}