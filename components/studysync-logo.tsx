type StudySyncLogoProps = {
  className?: string;
};

export function StudySyncLogo({ className = "size-10" }: StudySyncLogoProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ${className}`}
    >
      <img
        src="/studysync-logo.png"
        alt=""
        aria-hidden="true"
        className="h-full w-full object-contain"
      />
    </span>
  );
}
