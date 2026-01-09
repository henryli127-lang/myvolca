import React from 'react';
import { SelectionItem } from '../types';

interface SelectionCardProps {
  item: SelectionItem;
  isSelected: boolean;
  onSelect: (item: SelectionItem) => void;
}

const SelectionCard: React.FC<SelectionCardProps> = ({ item, isSelected, onSelect }) => {
  return (
    <div 
      onClick={() => onSelect(item)}
      className={`
        relative group cursor-pointer rounded-xl overflow-hidden transition-all duration-300 transform
        ${isSelected 
          ? 'ring-4 ring-primary-start scale-105 shadow-[0_0_20px_rgba(129,162,255,0.5)]' 
          : 'hover:scale-105 hover:shadow-xl border border-white/10'
        }
        bg-dark-card
      `}
    >
      <div className="aspect-square w-full overflow-hidden">
        <img 
          src={item.imageUrl} 
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className={`font-display font-bold text-lg mb-1 ${isSelected ? 'text-primary-start' : 'text-white'}`}>
          {item.name}
        </h3>
        <p className="text-xs text-gray-300 line-clamp-2">
          {item.description}
        </p>
      </div>

      {/* Selection Checkmark Indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 bg-primary-start text-dark-bg rounded-full p-1 shadow-lg animate-fade-in">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default SelectionCard;
