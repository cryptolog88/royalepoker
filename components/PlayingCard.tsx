import React from 'react';
import { Card as CardType } from '../types';
import { Heart, Diamond, Club, Spade } from 'lucide-react';

interface Props {
  card: CardType;
  className?: string;
  style?: React.CSSProperties;
}

const PlayingCard: React.FC<Props> = ({ card, className = '', style }) => {
  if (card.isHidden) {
    return (
      <div 
        className={`relative w-16 h-24 sm:w-20 sm:h-28 rounded-lg bg-blue-900 border-2 border-white/20 shadow-xl overflow-hidden ${className}`}
        style={style}
      >
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]"></div>
        <div className="flex items-center justify-center h-full">
            <div className="w-10 h-10 rounded-full bg-blue-800 border-2 border-blue-400 flex items-center justify-center">
                <span className="text-blue-200 font-serif font-bold text-xl">R</span>
            </div>
        </div>
      </div>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const Icon = card.suit === 'hearts' ? Heart : card.suit === 'diamonds' ? Diamond : card.suit === 'clubs' ? Club : Spade;

  return (
    <div 
      className={`relative w-16 h-24 sm:w-20 sm:h-28 bg-white rounded-lg shadow-xl flex flex-col justify-between p-1.5 sm:p-2 border border-gray-200 select-none transform hover:-translate-y-2 transition-transform duration-200 ${className}`}
      style={style}
    >
      <div className={`text-sm sm:text-base font-bold font-serif leading-none ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {card.rank}
        <Icon size={14} className="mt-0.5" fill={isRed ? "currentColor" : "currentColor"} />
      </div>
      
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
         <Icon size={40} className={isRed ? 'text-red-600' : 'text-slate-900'} fill="currentColor" />
      </div>

      <div className={`text-sm sm:text-base font-bold font-serif leading-none self-end transform rotate-180 ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {card.rank}
        <Icon size={14} className="mt-0.5" fill={isRed ? "currentColor" : "currentColor"} />
      </div>
    </div>
  );
};

export default PlayingCard;