import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fullPage?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '',
  fullPage = false
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-2',
    lg: 'w-16 h-16 border-3',
    xl: 'w-24 h-24 border-4'
  };

  // Simplified spinner logic using Tailwind animate-spin and border utilities
  const tailwindSpinner = (
    <div className={`flex items-center justify-center ${className}`}>
        <div 
          className={`animate-spin rounded-full ${sizeClasses[size].split(' ')[0]} ${sizeClasses[size].split(' ')[1]} border-b-2 border-orange-500`}
          style={{ borderTopColor: 'transparent' }}
        ></div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex items-center justify-center h-full w-full p-20 min-h-[300px]">
        {tailwindSpinner}
      </div>
    );
  }

  return tailwindSpinner;
};

export default LoadingSpinner;
