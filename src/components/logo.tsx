import React from 'react';

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function Logo({ width = 512, height = 512, className }: LogoProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={width} 
      height={height} 
      viewBox="0 0 512 512"
      className={className}
    >
      <rect width="512" height="512" fill="#f8f9fa"/>
      <circle cx="256" cy="200" r="60" fill="#007bff"/>
      <rect x="196" y="280" width="120" height="80" rx="10" fill="#28a745"/>
      <circle cx="220" cy="320" r="15" fill="#fff"/>
      <circle cx="292" cy="320" r="15" fill="#fff"/>
      <text x="256" y="420" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="24" fill="#333">Fusion</text>
    </svg>
  );
}
