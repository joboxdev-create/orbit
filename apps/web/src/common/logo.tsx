import Image from "next/image";
import Link from "next/link";

/** ORBIT logo: the round mark plus the wordmark, linking home by default. */
export function Logo({
  size = 36,
  href = "/",
  wordmark = true,
}: {
  size?: number;
  href?: string;
  wordmark?: boolean;
}) {
  const mark = (
    <Image
      src="/orbit.jpg"
      alt="ORBIT"
      width={size}
      height={size}
      priority
      style={{
        borderRadius: "50%",
        background: "#fff",
        border: "1px solid var(--border)",
        objectFit: "cover",
      }}
    />
  );

  if (!wordmark) {
    return href ? <Link href={href}>{mark}</Link> : mark;
  }

  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        textDecoration: "none",
        color: "var(--text)",
      }}
    >
      {mark}
      <strong style={{ fontSize: 18, letterSpacing: 0.5 }}>ORBIT</strong>
    </Link>
  );
}
