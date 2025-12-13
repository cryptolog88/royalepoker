import React from 'react';

export const Chips: React.FC<{ amount: number; className?: string }> = ({ amount, className }) => {
  if (amount === 0) return null;
  
  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <div className="relative">
        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-dashed border-white bg-amber-500 shadow-lg flex items-center justify-center text-[8px] sm:text-[10px] font-bold text-white ring-1 ring-black/20">
          $
        </div>
        {/* Visual stack effect if large amount */}
        {amount > 50 && <div className="absolute top-1 left-0.5 -z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-dashed border-white bg-amber-600"></div>}
      </div>
      <span className="text-amber-400 font-bold text-xs sm:text-sm drop-shadow-md font-serif">${amount}</span>
    </div>
  );
};