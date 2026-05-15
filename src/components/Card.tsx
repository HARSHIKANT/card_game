import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { PlayerCard } from '../types';

// card.tsx
function Card({ name, image, role, batting, bowling, average, stars, objectposition = "center", scale }: PlayerCard) {
    const [imageLoaded, setImageLoaded] = useState(false);
    
    const getImageUrl = (img: string) => {
      if (!img) return '';
      if (img.startsWith('http')) return img;
      const { data } = supabase.storage.from('players').getPublicUrl(img);
      return data.publicUrl;
    };

    const finalImageUrl = getImageUrl(image);

    return (
      <div className="shrink-0 w-[115px] h-[200px] sm:w-[140px] sm:h-[245px] md:w-[155px] md:h-[270px] bg-blue-600 rounded-sm shadow-xl ring-2 ring-orange-400 text-white font-sans overflow-hidden relative opacity-100 select-none">
          <div className="relative h-[70%] overflow-hidden bg-slate-800">
              {!imageLoaded && (
                <div className="absolute inset-0 bg-slate-700 animate-pulse flex items-center justify-center">
                   <div className="w-8 h-8 border-4 border-slate-600 border-t-orange-400 rounded-full animate-spin"></div>
                </div>
              )}
              {finalImageUrl && (
                <img 
                  src={finalImageUrl} 
                  alt={name} 
                  draggable={false}
                  onLoad={() => setImageLoaded(true)}
                  className={`object-cover w-full h-full transition-opacity duration-300 pointer-events-none ${imageLoaded ? 'opacity-100' : 'opacity-0'}`} 
                  style={{ objectPosition: objectposition, transform: `scale(${scale || 1})`, transformOrigin: "top"}}
                />
              )}
          </div>
          <div className="absolute top-[42%] left-1/2 transform -translate-x-1/2 inline-block whitespace-nowrap text-center bg-yellow-400 text-black text-[9px] sm:text-[11px] leading-none font-bold px-1.5 py-0.5 rounded shadow-sm z-10">{name?.toUpperCase()}</div>
          <div className="flex flex-col justify-between mt-1">
              <div>
                  <p className="text-center text-[9px] sm:text-xs mb-0.5">{role?.toUpperCase()}</p>
                  <div className="flex justify-between text-xs px-2 mb-1">
                      <div className="flex flex-col items-center">
                          <span className="text-[8px] sm:text-[9px] text-slate-300">BOWL</span>
                          <span className="text-base sm:text-lg font-black leading-none text-white drop-shadow-md">{bowling}</span>
                      </div>
                      <div className="flex flex-col items-center">
                          <span className="text-[8px] sm:text-[9px] text-slate-300">BAT</span>
                          <span className="text-base sm:text-lg font-black leading-none text-white drop-shadow-md">{batting}</span>
                      </div>
                  </div>
              </div>
              <div>
                  <div className="flex justify-center -mt-6 mb-1">
                      <div className="bg-white text-black px-1.5 py-0.5 rounded-full font-bold text-[9px] sm:text-[10px] shadow-sm">Avg: {average}</div>
                  </div>
                  <div className="flex justify-center -mt-1 pb-1">
                      <span className="text-yellow-400 text-[9px] sm:text-[10px] drop-shadow-sm">{'★'.repeat(stars || 0)}{'☆'.repeat(5-(stars || 0))}</span>
                  </div>
              </div>
          </div>
      </div>
    )
}

export default Card;