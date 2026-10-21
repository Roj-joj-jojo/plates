import type { ReactNode } from "react";
import { HeaderActions } from "@/components/header-actions";

type PageLayoutProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backLink?: ReactNode;
  children: ReactNode;
  readMarker?: ReactNode;
  leading?: ReactNode;
};

export function PageHeader({ title, description, backLink, readMarker, leading }: Pick<PageLayoutProps, "title" | "description" | "backLink" | "readMarker" | "leading">) {
  return <header data-surface="dark" className="bg-foreground text-primary-foreground">
      {readMarker}
      <div className="relative mx-auto grid max-w-thread grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-4 py-3 sm:block sm:py-5 thread:px-6">
      {backLink && <div className="col-span-2 mb-2 sm:mb-3 sm:pr-36 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:rounded-md [&_a]:px-2 [&_a]:text-primary-foreground [&_a]:hover:bg-card/10">{backLink}</div>}
      <div className={`col-start-2 ${backLink ? "row-start-2" : "row-start-1"} sm:absolute sm:right-4 sm:top-1/2 sm:-translate-y-1/2 thread:right-6`}><HeaderActions /></div>
      <div className={`col-start-1 min-w-0 ${backLink ? "row-start-2" : "row-start-1"} sm:pr-36`}>
        <div className="flex items-center gap-3">
          {leading}
          <div className="min-w-0 flex-1 basis-48">
            <h1 className="break-words font-display text-xl font-bold leading-6 sm:text-table-title">{title}</h1>
            {description && <p className="mt-1 hidden max-w-xl text-sm leading-6 text-primary-foreground/80 sm:block">{description}</p>}
          </div>
        </div>
      </div>
      {description && <p className="col-span-2 mt-1 max-w-xl text-xs leading-5 text-primary-foreground/80 sm:hidden">{description}</p>}
      </div>
    </header>;
}

export function PageLayout({ title, description, actions, backLink, children, readMarker, leading }: PageLayoutProps) {
  return <>
    <PageHeader title={title} description={description} backLink={backLink} readMarker={readMarker} leading={leading} />
    <div className="mx-auto min-w-0 max-w-thread px-4 py-4 sm:py-6 thread:px-6 thread:py-8 [&>:first-child]:mt-0">
      {actions && <div className="mb-5 flex flex-wrap items-center justify-end gap-2">{actions}</div>}
      {children}
    </div>
  </>;
}
