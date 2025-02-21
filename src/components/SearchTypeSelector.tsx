import React from 'react';
import './SearchTypeSelector.css';

export interface SearchType {
  id: string;
  label: string;
  description: string;
  template: string;
}

interface SearchTypeSelectorProps {
  onSelect: (template: string) => void;
  onClose: () => void;
}

const searchTypes: SearchType[] = [
  {
    id: 'social-analysis',
    label: 'Social Media Analysis',
    description: 'Comprehensive social media presence analysis for a person or brand',
    template: '@web social media analysis for [person/brand]'
  },
  {
    id: 'person-info',
    label: 'Person Information',
    description: 'Detailed person analysis with social context',
    template: '@web who is [person]'
  },
  {
    id: 'deep-analysis',
    label: 'Deep Analysis',
    description: 'In-depth cross-platform analysis of a topic or person',
    template: '@web deep analysis [topic/person]'
  }
];

export const SearchTypeSelector: React.FC<SearchTypeSelectorProps> = ({ onSelect, onClose }) => {
  return (
    <div className="search-type-selector">
      <div className="search-type-header">
        <h3>Select Search Type</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="search-type-list">
        {searchTypes.map((type) => (
          <div
            key={type.id}
            className="search-type-item"
            onClick={() => {
              onSelect(type.template);
              onClose();
            }}
          >
            <h4>{type.label}</h4>
            <p>{type.description}</p>
            <code>{type.template}</code>
          </div>
        ))}
      </div>
    </div>
  );
};
