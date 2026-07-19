import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-12 h-12 rounded-xl',
  };

  return (
    <div className={`bg-blue-600 flex items-center justify-center text-white shadow-md shrink-0 select-none ${sizeClasses[size]} ${className}`}>
      <svg
        viewBox="0 0 100 100"
        className="w-[52%] h-[52%] fill-none stroke-current"
        strokeWidth="13"
        strokeLinecap="square"
        strokeLinejoin="miter"
      >
        <defs>
          <mask id="flatmath-logo-split-mask">
            {/* The white background allows the glyph to be visible */}
            <rect x="0" y="0" width="100" height="100" fill="white" />
            {/* The black diagonal line slices a gap through the glyph to show the background */}
            <path 
              d="M 15 65 L 85 35" 
              stroke="black" 
              strokeWidth="5" 
              strokeLinecap="square" 
            />
          </mask>
        </defs>

        {/* Render glyph inside the mask group */}
        <g mask="url(#flatmath-logo-split-mask)">
          {/* Merged F + Plus Sign Path with perfectly sharp geometry */}
          <path d="M 32 75 V 25 H 68 M 32 50 H 78 M 62 34 V 66" />
        </g>
      </svg>
    </div>
  );
};

export default Logo;
