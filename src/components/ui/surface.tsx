import type { ReactNode } from "react";

type SurfaceProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  printSection?: string;
};

export function Surface({
  title,
  description,
  actions,
  children,
  className = "",
  printSection,
}: SurfaceProps) {
  return (
    <section
      data-print-section={printSection}
      className={`rounded-lg border border-[#d8ddd3] bg-white p-5 shadow-sm ${className}`}
    >
      {(title || description || actions) ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? (
              <h2 className="text-lg font-semibold">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-[#687067]">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}
