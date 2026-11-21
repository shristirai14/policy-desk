import { CircleCheck } from "lucide-react";
import { Brand } from "@/components/brand-mark";

const HIGHLIGHTS = [
  "Premiums from a step-based rating engine",
  "E-sign with one-time codes",
  "An audit trail on every change",
];

const RINGS = [140, 240, 340, 440, 540, 640];

function HeroPattern() {
  return (
    <svg aria-hidden="true" className="absolute inset-0 -z-10 size-full" preserveAspectRatio="xMaxYMax slice">
      <defs>
        <pattern id="auth-hero-dots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.1" className="fill-hero-muted" fillOpacity="0.24" />
        </pattern>
        <linearGradient id="auth-hero-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="auth-hero-mask">
          <rect width="100%" height="100%" fill="url(#auth-hero-fade)" />
        </mask>
      </defs>
      <g mask="url(#auth-hero-mask)">
        <g className="animate-drift">
          <rect x="-24" y="-24" width="4000" height="4000" fill="url(#auth-hero-dots)" />
        </g>
      </g>
      <svg x="100%" y="100%" overflow="visible">
        {RINGS.map((r, index) => (
          <circle
            key={r}
            r={r}
            fill="none"
            strokeWidth="1"
            className={index === 2 ? "stroke-hero-accent/45" : "stroke-hero-line"}
          />
        ))}
      </svg>
    </svg>
  );
}

export function AuthHero() {
  return (
    <section className="relative isolate m-3 mr-0 hidden animate-fade flex-col justify-between gap-8 overflow-hidden rounded-2xl bg-hero p-10 text-hero-foreground lg:flex">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(640px_circle_at_0%_0%,var(--hero-glow),transparent_70%)]" />
      <HeroPattern />
      <Brand markClassName="bg-hero-accent text-hero" />
      <div className="stagger flex max-w-[460px] flex-col gap-4">
        <p className="text-xs font-medium tracking-[0.08em] text-hero-accent uppercase">Motor insurance desk</p>
        <h2 className="font-serif text-[40px] leading-[46px] font-medium tracking-[-0.01em] text-balance">
          Quote, rate and issue motor policies from one desk.
        </h2>
        <p className="max-w-[400px] text-base text-hero-muted">
          Every quote, signature and policy for your agency, in one place your whole team can trust.
        </p>
        <ul className="mt-2 flex flex-col gap-2.5">
          {HIGHLIGHTS.map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm">
              <CircleCheck className="size-4 text-hero-accent" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-hero-muted">Secured with email codes and authenticator apps.</p>
    </section>
  );
}
