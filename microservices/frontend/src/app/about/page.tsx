"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { redirect } from "next/navigation";

const teamMembers = [
  {
    name: "Alex Morgan",
    role: "Founder & Co-CEO",
    bio: "Alex brings a passion for horology and a keen eye for quality to Finite Watches, ensuring that every timepiece in our collection meets the highest standards.",
    initials: "AM",
  },
  {
    name: "Jordan Lee",
    role: "Founder & Co-CEO",
    bio: "Jordan combines a deep knowledge of horology with a commitment to exceptional customer service, ensuring every client finds their perfect watch.",
    initials: "JL",
  },
  {
    name: "Taylor Reed",
    role: "SoMe & Marketing",
    bio: "Taylor brings creativity and strategic thinking to our marketing efforts, ensuring our brand resonates with watch enthusiasts worldwide.",
    initials: "TR",
  },
]


export default function AboutPage() {
  return (
    <div className="container mx-auto px-3 py-6">
      {/* Hero */}
      <section className="grid md:grid-cols-2 mb-12 gap-10">
        <div>
          <h1 className="text-4xl md:text-5xl font-seasons mb-4 mt-4">
            About Finite Watches
          </h1>
          <p className="text-lg text-foreground/80">
            Welcome to our little corner of the watch universe, where we hope
            you’ll feel comfortable and take your time exploring our selection
            of pre-owned watches at your own pace.
            <br />
            <br />
            Our door is always open for questions — whether you’re an
            experienced watch buyer or about to make your very first watch
            investment. We take pride in making you feel welcome, respected, and
            confident, and we’re happy to guide you on your journey toward
            finding the perfect watch for yourself, or perhaps help you find
            just the right watch gift for someone special.
            <br />
            <br />
            We are very proud to deal in pre-owned watches. We celebrate the
            traditional craftsmanship, which we find incredibly fascinating,
            functional, and beautiful.
            <br />
            <br />
            We take great joy in being part of an industry where the product
            isn’t discarded after a short period of use, but instead has an
            exceptional lifespan — where watches can change hands and bring new
            joy again and again.
            <br />
            <br />
            We’re delighted to welcome you!
          </p>

          <div className="mt-6 flex gap-4">
            <Button size="lg" onClick={() => redirect("/watches")}>
              Shop Collection
            </Button>
            <Button size="lg" variant="outline" onClick={() => redirect("/contact")}>
              Contact Us
            </Button>
          </div>
        </div>
        
        {/* Hero image placeholder */}
        <div className="overflow-hidden">
          <img
            src="/about-page-hero.jpg"
            alt="Hero Image"
            className="w-full h-auto rounded-lg"
          />
        </div>
      </section>      

      {/* Team */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">The Team</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {teamMembers.map((member, i) => (
            <div
              key={i}
              className="flex flex-col items-center text-center p-4 rounded-lg hover:shadow-lg transition-all"
            >
              <div className="h-28 w-28 rounded-full overflow-hidden bg-slate-200 mb-4 flex items-center justify-center text-2xl font-semibold text-foreground/70">
                {member.initials}
              </div>
              <h4 className="font-semibold">{member.name}</h4>
              <h3 className="text-sm text-foreground/80 mb-4">{member.role}</h3>
              <p className="text-sm text-foreground/80">
                {member.bio}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mb-12 rounded-lg p-8 bg-linear-to-r from-champagne to-amber-100/80 text-center">
        <h3 className="text-xl font-semibold mb-2">Get first access to rare finds</h3>
        <p className="text-foreground/80 mb-4">
          Receive curated drop alerts, VIP previews and member-only invitations — delivered straight to your inbox.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Input className="w-xl" placeholder="Enter your email" />
          <Button className="inline-flex items-center rounded-md px-4 py-2 text-sm font-mediumshadow-sm">
            Get early access
          </Button>
        </div>
      </section>
    </div>
  );
}
