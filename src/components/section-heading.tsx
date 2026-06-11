type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  copy?: string;
  level?: "h1" | "h2";
};

export function SectionHeading({ eyebrow, title, copy, level = "h2" }: SectionHeadingProps) {
  const Heading = level;

  return (
    <div className="max-w-2xl">
      {eyebrow ? <p className="text-sm font-semibold uppercase tracking-[0.16em] text-clay">{eyebrow}</p> : null}
      <Heading className="mt-3 font-serif text-3xl text-ink sm:text-4xl">{title}</Heading>
      {copy ? <p className="mt-4 text-base leading-7 text-ink/70">{copy}</p> : null}
    </div>
  );
}
