import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const PlayIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><path d="m7 4 13 8-13 8Z" fill="currentColor" stroke="none" /></svg>;
export const InfoIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1"/></svg>;
export const SearchIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
export const BellIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>;
export const PlusIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><path d="M12 5v14M5 12h14"/></svg>;
export const CheckIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><path d="m5 12 4 4L19 6"/></svg>;
export const CloseIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><path d="m6 6 12 12M18 6 6 18"/></svg>;
export const ChevronIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><path d="m9 18 6-6-6-6"/></svg>;
export const FullscreenIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>;
export const ExitFullscreenIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></svg>;
export const PauseIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><path d="M8 5v14M16 5v14" strokeWidth="3"/></svg>;
export const VolumeIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><path d="M11 5 6 9H3v6h3l5 4zM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></svg>;
export const MutedIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6M21 9l-5 6"/></svg>;
export const RewindIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><path d="M3 12a9 9 0 1 0 3-6.7M3 4v6h6"/><text x="8" y="16" fill="currentColor" stroke="none" fontSize="8">10</text></svg>;
export const ForwardIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><path d="M21 12a9 9 0 1 1-3-6.7M21 4v6h-6"/><text x="8" y="16" fill="currentColor" stroke="none" fontSize="8">10</text></svg>;
export const SettingsIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>;
export const PictureInPictureIcon = (p: IconProps) => <svg viewBox="0 0 24 24" {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="1"/><rect x="12" y="11" width="7" height="5" fill="currentColor" stroke="none"/></svg>;
