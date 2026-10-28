// Batch 5: the admin page heading (the old SectionHeading, without the eyebrow label).
export function AdminHeading({ title, copy }: { title: string; copy?: string }) {
  return (
    <div className="max-w-2xl">
      <h1 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
      {copy ? <p className="mt-3 text-base leading-7 text-ink/75">{copy}</p> : null}
    </div>
  );
}
