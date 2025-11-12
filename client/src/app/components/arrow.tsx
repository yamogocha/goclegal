"use client"

type ArrowType = {
  className?: string
  size?: number
  color?: string
  onClick?: () => void
}
export default function Arrow({ className, size = 24, color = "#fff", onClick }: ArrowType) {
    return (
      <span className={className} onClick={onClick}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 5L15 12L8 19"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  