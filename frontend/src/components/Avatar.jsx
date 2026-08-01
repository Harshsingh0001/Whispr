export default function Avatar({ name, color, isOnline, size = 40 }) {
  const initial = name?.charAt(0)?.toUpperCase() || '?';
  return (
    <div className="avatar-wrapper" style={{ width: size, height: size }}>
      <div className="avatar-circle" style={{ background: color || '#888', width: size, height: size, fontSize: size * 0.4 }}>
        {initial}
      </div>
      {isOnline && <span className="online-dot" />}
    </div>
  );
}
