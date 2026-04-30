'use client'
import { useEffect, useState } from 'react'

interface UserTag {
  id: string
  text: string
  color: string
  textColor: string
  sparkly: boolean
}

interface UserTagsBadgeProps {
  userId: string
  size?: 'sm' | 'md'
  className?: string
}

export default function UserTagsBadge({ userId, size = 'sm', className = '' }: UserTagsBadgeProps) {
  const [tags, setTags] = useState<UserTag[]>([])

  useEffect(() => {
    if (!userId) return
    fetch(`/api/users/${userId}/tags`)
      .then(r => r.json())
      .then(d => setTags(d.tags || []))
      .catch(() => {})
  }, [userId])

  if (tags.length === 0) return null

  const fontSize = size === 'sm' ? 'text-[9px]' : 'text-[11px]'
  const padding = size === 'sm' ? 'px-1.5 py-0' : 'px-2 py-0.5'

  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {tags.map(tag => (
        <span
          key={tag.id}
          className={`${fontSize} ${padding} rounded-full font-medium whitespace-nowrap ${
            tag.sparkly ? 'animate-tag-sparkle' : ''
          }`}
          style={{
            backgroundColor: tag.color,
            color: tag.textColor,
            boxShadow: tag.sparkly ? `0 0 8px ${tag.color}80, 0 0 16px ${tag.color}40` : 'none',
          }}
        >
          {tag.sparkly && <span className="mr-0.5">✨</span>}
          {tag.text}
        </span>
      ))}
    </div>
  )
}
