import React, { useState, useEffect } from 'react';
import { CHARACTERS, SETTINGS } from './constants';
import { SelectionItem, StoryState, GenerationStatus } from './types';
import SelectionCard from './components/SelectionCard';
import StoryDisplay from './components/StoryDisplay';
import { generateStoryContent } from './services/geminiService';

const App: React.FC = () => {
  const [selectedCharacter, setSelectedCharacter] = useState<SelectionItem | null>(null);
  const [selectedSetting, setSelectedSetting] = useState<SelectionItem | null>(null);
  const [story, setStory] = useState<StoryState | null>(null);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedCharacter || !selectedSetting) return;

    setStatus('generating');
    setErrorMsg(null);

    try {
      const result = await generateStoryContent(selectedCharacter, selectedSetting);
      setStory({
        title: result.title,
        content: result.content,
        quiz: result.quiz,
        isGenerated: true,
        timestamp: Date.now(),
      });
      setStatus('success');
    } catch (err) {
      console.error(err);
      setErrorMsg("Oops! We couldn't write the story right now. Please try again.");
      setStatus('error');
    }
  };

  const handleReset = () => {
    setStory(null);
    setStatus('idle');
    // We can keep selections or clear them. PRD implies easy "re-use", but let's keep them for now.
    // Uncomment next lines to clear selections on reset:
    // setSelectedCharacter(null);
    // setSelectedSetting(null);
  };

  const isSelectionComplete = !!selectedCharacter && !!selectedSetting;

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text font-sans selection:bg-primary-start selection:text-white">
      {/* Background decoration */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary-start/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 right-0 w-80 h-80 bg-primary-end/10 rounded-full blur-[80px]" />
      </div>

      <header className="py-8 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-display font-bold bg-gradient-to-r from-primary-start to-primary-end bg-clip-text text-transparent mb-2 inline-block">
          StorySpark AI
        </h1>
        <p className="text-gray-400 text-lg">Create your own adventure in seconds!</p>
      </header>

      <main className="container mx-auto px-4 pb-12">
        {status === 'success' && story ? (
          <StoryDisplay story={story} onReset={handleReset} />
        ) : (
          <div className="animate-fade-in max-w-5xl mx-auto space-y-12">
            
            {/* Character Selection */}
            <section>
              <div className="flex items-center space-x-3 mb-6">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-start/20 text-primary-start font-bold">1</span>
                <h2 className="text-2xl font-display font-bold text-white">Choose a Character</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {CHARACTERS.map((char) => (
                  <SelectionCard
                    key={char.id}
                    item={char}
                    isSelected={selectedCharacter?.id === char.id}
                    onSelect={setSelectedCharacter}
                  />
                ))}
              </div>
            </section>

            {/* Setting Selection */}
            <section>
              <div className="flex items-center space-x-3 mb-6">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-end/20 text-primary-end font-bold">2</span>
                <h2 className="text-2xl font-display font-bold text-white">Choose a Setting</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {SETTINGS.map((setting) => (
                  <SelectionCard
                    key={setting.id}
                    item={setting}
                    isSelected={selectedSetting?.id === setting.id}
                    onSelect={setSelectedSetting}
                  />
                ))}
              </div>
            </section>

            {/* Generate Action */}
            <div className="sticky bottom-6 z-20 flex flex-col items-center">
               {errorMsg && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg text-sm">
                  {errorMsg}
                </div>
              )}
              
              <button
                onClick={handleGenerate}
                disabled={!isSelectionComplete || status === 'generating'}
                className={`
                  relative overflow-hidden group
                  px-12 py-4 rounded-full font-display font-bold text-xl tracking-wide shadow-2xl transition-all duration-300
                  ${!isSelectionComplete 
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-primary-start to-primary-end text-dark-bg hover:scale-105 hover:shadow-[0_0_30px_rgba(129,162,255,0.6)]'
                  }
                `}
              >
                {status === 'generating' ? (
                  <div className="flex items-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-dark-bg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Writing Magic...</span>
                  </div>
                ) : (
                  <span>Generate Story ✨</span>
                )}
              </button>
              
              {!isSelectionComplete && (
                <p className="mt-3 text-sm text-gray-500">
                  Select a character and a setting to start.
                </p>
              )}
            </div>
            
            <div className="h-12" /> {/* Spacer for sticky button */}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
