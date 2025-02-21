import React, { useState, useEffect } from 'react';
import './LoadingIndicator.css';

interface LoadingIndicatorProps {
  isWebSearch?: boolean;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ isWebSearch }) => {
  const [dots, setDots] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<number>(0);

  const steps = isWebSearch 
    ? [
        'Searching the web',
        'Analyzing results',
        'Processing information',
        'Preparing response'
      ]
    : [
        'Thinking',
        'Processing',
        'Analyzing',
        'Generating'
      ];

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev: string) => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    const stepInterval = setInterval(() => {
      setCurrentStep((prev: number) => (prev + 1) % steps.length);
    }, 2000);

    return () => {
      clearInterval(dotInterval);
      clearInterval(stepInterval);
    };
  }, [steps.length]);

  return (
    <div className={`loading-indicator ${isWebSearch ? 'web-search' : ''}`}>
      <div className="loading-dots">
        <div></div>
        <div></div>
        <div></div>
      </div>
      <span>{steps[currentStep]}{dots}</span>
    </div>
  );
};

export default LoadingIndicator;
