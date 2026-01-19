import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', className, children, ...props }) => {
  const baseStyle = "font-bold rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center justify-center border-b-4";
  
  const variants = {
    primary: "bg-green-500 text-white border-green-700 hover:bg-green-400",
    secondary: "bg-blue-500 text-white border-blue-700 hover:bg-blue-400",
    danger: "bg-red-500 text-white border-red-700 hover:bg-red-400",
  };
  
  const sizes = {
    sm: "px-3 py-1 text-sm",
    md: "px-6 py-3 text-lg",
    lg: "px-8 py-4 text-xl w-full",
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className || ''}`}
      {...props}
    >
      {children}
    </button>
  );
};