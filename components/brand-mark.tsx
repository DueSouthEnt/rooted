/** Combined flower and vegetable mark, in the same line as the bouquet icon. */
export function BrandMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className}>
      <path d="M6 37h36" fill="none" stroke="#c4a574" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M16 37V23" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 30c-4 1.4-8 5-8 5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d="M16 23c-3.4-4.8-9.2-4.4-9.2 1 3 .6 6 1.2 9.2 4 3.2-2.8 6.2-3.4 9.2-4 0-5.4-5.8-5.8-9.2-1Z"
        fill="none"
        stroke="#c45b86"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path d="M33 22c-1.8 6-1.5 11 .2 15 1.8-3.6 2-9.2-.2-15Z" fill="none" stroke="#c46a3a" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M33 22c-3.6-2.4-6-6.6-3.8-9" fill="none" stroke="#3f5c49" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M33 22c3.4-1.8 6.6-5.4 4.6-8.2" fill="none" stroke="#6d8a74" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M31 29c-2.4.8-3.6 1-4.6.2" fill="none" stroke="#c46a3a" strokeWidth="1.15" strokeLinecap="round" />
    </svg>
  );
}
