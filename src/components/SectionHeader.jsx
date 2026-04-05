function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-6 flex animate-fade-in-up flex-col gap-4 md:mb-7 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="brand-badge">{eyebrow}</p> : null}
        <h2 className="mt-2 font-display text-[1.9rem] font-bold leading-tight text-white sm:text-[2.15rem]">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-[15px]">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-3 md:justify-end">{action}</div> : null}
    </div>
  );
}

export default SectionHeader;
