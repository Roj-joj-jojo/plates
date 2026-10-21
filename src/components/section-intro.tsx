type SectionIntroProps = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
};

export function SectionIntro({ title, description, emptyTitle, emptyDescription }: SectionIntroProps) {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-lg text-base leading-7 text-muted-foreground">{description}</p>
      <section className="mt-8 rounded-2xl border border-border bg-card px-6 py-12 text-center sm:px-10">
        <span aria-hidden="true" className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full border-2 border-input bg-card">
          <span className="size-11 rounded-full border border-input bg-card" />
        </span>
        <h2 className="text-lg font-semibold">{emptyTitle}</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{emptyDescription}</p>
      </section>
    </>
  );
}
