export interface SelectionItem {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
  type: 'character' | 'setting';
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface StoryState {
  title: string;
  content: string;
  quiz?: QuizQuestion[];
  isGenerated: boolean;
  timestamp: number;
}

export type GenerationStatus = 'idle' | 'generating' | 'success' | 'error';
