// Shared stroke icons (24×24 grid, currentColor). Every icon is decorative: aria-hidden.
function StrokeIcon({ size, strokeWidth = 2, className = '', children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon({ size = 18, ...props }) {
  return <StrokeIcon size={size} {...props}><path d="M3 10.5 12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H15v-6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v6H4.5A1.5 1.5 0 0 1 3 20Z" /></StrokeIcon>;
}

export function SearchIcon({ size = 16, ...props }) {
  return <StrokeIcon size={size} strokeWidth={2.2} {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.8-3.8" /></StrokeIcon>;
}

export function BellIcon({ size = 18, ...props }) {
  return <StrokeIcon size={size} {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></StrokeIcon>;
}

export function MessageIcon({ size = 18, ...props }) {
  return (
    <StrokeIcon size={size} {...props}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </StrokeIcon>
  );
}

export function UserIcon({ size = 16, ...props }) {
  return <StrokeIcon size={size} {...props}><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 0 0-16 0" /></StrokeIcon>;
}

export function ChevronDownIcon({ size = 12, ...props }) {
  return <StrokeIcon size={size} strokeWidth={2.5} {...props}><path d="m6 9 6 6 6-6" /></StrokeIcon>;
}

export function ChevronLeftIcon({ size = 16, ...props }) {
  return <StrokeIcon size={size} strokeWidth={2.5} {...props}><path d="m15 18-6-6 6-6" /></StrokeIcon>;
}

export function ChevronRightIcon({ size = 16, ...props }) {
  return <StrokeIcon size={size} strokeWidth={2.5} {...props}><path d="m9 18 6-6-6-6" /></StrokeIcon>;
}

export function CheckIcon({ size = 16, ...props }) {
  return <StrokeIcon size={size} strokeWidth={2.5} {...props}><path d="m5 12 4 4L19 6" /></StrokeIcon>;
}

export function LockIcon({ size = 16, ...props }) {
  return <StrokeIcon size={size} {...props}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></StrokeIcon>;
}

export function CircleIcon({ size = 16, className = '', ...props }) {
  return <span className={className} style={{ width: size, height: size }} aria-hidden="true" {...props} />;
}

export function MenuIcon({ size = 20, ...props }) {
  return <StrokeIcon size={size} {...props}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></StrokeIcon>;
}

export function CloseIcon({ size = 20, ...props }) {
  return <StrokeIcon size={size} {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></StrokeIcon>;
}
