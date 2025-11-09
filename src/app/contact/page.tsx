"use client"

import { useState } from 'react';
import { Mail, Phone, Clock, Calendar } from 'lucide-react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [submitStatus, setSubmitStatus] = useState('');

  const handleSubmit = () => {
    if (!formData.name || !formData.email || !formData.message) {
      return;
    }
    setSubmitStatus('sending');
    
    // Simulate form submission
    setTimeout(() => {
      setSubmitStatus('success');
      setFormData({ name: '', email: '', phone: '', message: '' });
      setTimeout(() => setSubmitStatus(''), 3000);
    }, 1500);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl font-serif mb-3">Contact Us</h1>
          <p className="text-slate-300 text-lg">We're here to assist you with your timepiece journey</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Contact Form - Takes 2 columns */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <h2 className="text-2xl font-serif mb-6 text-slate-900">Send Us a Message</h2>
              
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Your Message *
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={6}
                    className="w-full px-4 py-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition resize-none"
                  ></textarea>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitStatus === 'sending'}
                  className="w-full bg-slate-900 text-white py-4 rounded-md font-medium hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitStatus === 'sending' ? 'Sending...' : 
                   submitStatus === 'success' ? 'Message Sent!' : 
                   'Send Message'}
                </button>
              </div>
            </div>
          </div>

          {/* Contact Information Sidebar */}
          <div className="space-y-6">
            
            {/* Opening Hours */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center mb-4">
                <Clock className="w-5 h-5 text-slate-900 mr-2" />
                <h3 className="text-lg font-semibold text-slate-900">Opening Hours</h3>
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
                      +1 (212) 555-1234
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
                Schedule a personal appointment to experience our timepieces in an exclusive setting.
              </p>
              <button className="w-full bg-white text-slate-900 py-3 rounded-md font-medium hover:bg-slate-100 transition">
                Book Appointment
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}