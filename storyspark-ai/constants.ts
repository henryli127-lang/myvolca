import { SelectionItem } from './types';

export const CHARACTERS: SelectionItem[] = [
  {
    id: 'char_labubu',
    name: 'Labubu',
    // Using styled text placeholders to ensure the image clearly matches the specific character name
    imageUrl: 'https://placehold.co/400x400/252540/81a2ff?text=Labubu&font=roboto',
    description: 'A quirky, mischievous little monster with long ears and a wide smile.',
    type: 'character'
  },
  {
    id: 'char_mickey',
    name: 'Mickey Mouse',
    imageUrl: 'https://placehold.co/400x400/252540/81a2ff?text=Mickey+Mouse&font=roboto',
    description: 'A cheerful, iconic mouse who loves adventure and fun.',
    type: 'character'
  },
  {
    id: 'char_elsa',
    name: 'Queen Elsa',
    imageUrl: 'https://placehold.co/400x400/252540/81a2ff?text=Queen+Elsa&font=roboto',
    description: 'A magical queen with the power to control ice and snow.',
    type: 'character'
  },
  {
    id: 'char_buzz',
    name: 'Buzz Lightyear',
    imageUrl: 'https://placehold.co/400x400/252540/81a2ff?text=Buzz+Lightyear&font=roboto',
    description: 'A heroic space ranger toy ready to go to infinity and beyond.',
    type: 'character'
  }
];

export const SETTINGS: SelectionItem[] = [
  {
    id: 'set_1',
    name: 'Mysterious Island',
    imageUrl: 'https://picsum.photos/seed/jungle_ruins_mystery/400/400',
    description: 'A hidden land filled with ancient ruins and jungle.',
    type: 'setting'
  },
  {
    id: 'set_2',
    name: 'Cyber City',
    imageUrl: 'https://picsum.photos/seed/neon_cyberpunk_city_future/400/400',
    description: 'A glowing metropolis of the future with flying cars.',
    type: 'setting'
  },
  {
    id: 'set_3',
    name: 'Enchanted Forest',
    imageUrl: 'https://picsum.photos/seed/magical_forest_fantasy/400/400',
    description: 'A deep wood where trees whisper and fairies dance.',
    type: 'setting'
  },
  {
    id: 'set_4',
    name: 'Mars Base',
    imageUrl: 'https://picsum.photos/seed/mars_red_planet_space/400/400',
    description: 'A red dusty planet with a high-tech science lab.',
    type: 'setting'
  }
];