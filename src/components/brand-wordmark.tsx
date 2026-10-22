import Image from "next/image";

export function BrandWordmark({ className = "", onDark = false }: { className?: string; onDark?: boolean }) {
  return <Image
    src={`/brand/dinnerfolk-wordmark-on-${onDark ? "dark" : "light"}.svg`}
    alt="Dinnerfolk"
    width={657}
    height={100}
    loading="eager"
    unoptimized
    className={`block h-auto max-w-full ${className}`}
  />;
}
