import Link from "next/link";
import {
  Facebook,
  Instagram,
  Twitter,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container mx-auto px-4 py-8">
        {/* Brand Section */}
        <div className="mb-6">
          <div className="flex flex-col items-center text-center">
            <h3 className="text-xl font-bold flex-row">
              Limited Watches
            </h3>
            
            <div className="flex space-x-4">
              <Link
                href="https://www.instagram.com/limited__watches"
                className="text-foreground/60 hover:text-champagne transition-colors mt-2"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Three Column Section */}
        <div className="grid grid-cols-3 justify-center max-w-7xl mr-9 mx-auto">
          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold text-foreground">
              Quick Links
            </h4>
            <ul>
              <li>
                <Link
                  href="/"
                  className="text-foreground/80 hover:text-champagne transition-colors text-sm"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/watches"
                  className="text-foreground/80 hover:text-champagne transition-colors text-sm"
                >
                  Our Collection
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-foreground/80 hover:text-champagne transition-colors text-sm"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-foreground/80 hover:text-champagne transition-colors text-sm"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="text-lg font-semibold text-foreground">
              Customer Service
            </h4>
            <ul>
              <li>
                <Link
                  href="/shipping"
                  className="text-foreground/80 hover:text-champagne transition-colors text-sm"
                >
                  Shipping Info
                </Link>
              </li>
              <li>
                <Link
                  href="/returns"
                  className="text-foreground/80 hover:text-champagne transition-colors text-sm"
                >
                  Returns & Exchanges
                </Link>
              </li>
              <li>
                <Link
                  href="/warranty"
                  className="text-foreground/80 hover:text-champagne transition-colors text-sm"
                >
                  Warranty
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-foreground/80 hover:text-champagne transition-colors text-sm"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold text-foreground">
              Contact Info
            </h4>
            <div>
              <div className="flex items-center space-x-3">
                <MapPin className="h-4 w-4 text-champagne shrink-0" />
                <span className="text-foreground/80 text-sm">
                  Greve, Denmark
                  <br />
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="h-4 w-4 text-champagne shrink-0" />
                <span className="text-foreground/80 text-sm">
                  +45 26 46 95 96
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-champagne shrink-0" />
                <span className="text-foreground/80 text-sm">
                  contact@limitedwatches.com
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-4 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 mt-2">
            <p className="text-foreground/60 text-sm">
              © {new Date().getFullYear()} Limited Watches. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <Link
                href="/privacy"
                className="text-foreground/60 hover:text-champagne transition-colors text-sm"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-foreground/60 hover:text-champagne transition-colors text-sm"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
