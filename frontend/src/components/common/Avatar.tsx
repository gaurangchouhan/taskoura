import React, { useState } from 'react';

export interface AvatarProps {
  src?: string | null;
  name?: string;
  email?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
  dataTestId?: string;
  title?: string;
}

export function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return 'U';
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-10 h-10 text-xs',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  email,
  size = 'md',
  className = '',
  alt,
  dataTestId,
  title,
}) => {
  const [imageError, setImageError] = useState(false);
  const initials = getInitials(name, email);
  const altText = alt || name || email || 'User Avatar';

  const hasImage = Boolean(src && src.trim() && !imageError);

  return (
    <div
      data-testid={dataTestId}
      title={title || name || email}
      className={`relative inline-flex items-center justify-center font-bold text-white bg-gradient-to-tr from-sky-500 via-sky-600 to-indigo-600 select-none overflow-hidden shrink-0 ${sizeClasses[size]} ${className}`}
    >
      {hasImage ? (
        <img
          src={src!}
          alt={altText}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

export default Avatar;
