export function ProfileAvatar({ value }: { value: string }) {
  return isImageAvatar(value) ? <img src={value} alt=""/> : <>{presetAvatars.includes(value) ? value : "🎬"}</>;
}

export function isImageAvatar(value: string) { return value.startsWith("/avatars/") || value.startsWith("https://") || value.startsWith("http://"); }
const presetAvatars = ["🎬","🍿","🎞️","📽️","⭐","👻","🤖","🦊","🐼","🦁","😎","🧙"];
