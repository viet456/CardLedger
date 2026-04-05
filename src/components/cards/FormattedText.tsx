import React from 'react';
import { EnergyIcon } from './EnergyIcon'; 

const SYMBOL_MAP: Record<string, string> = {
    'G': 'Grass',
    'R': 'Fire',
    'W': 'Water',
    'L': 'Lightning',
    'P': 'Psychic',
    'F': 'Fighting',
    'D': 'Darkness',
    'M': 'Metal',
    'Y': 'Fairy',
    'N': 'Dragon',
    'C': 'Colorless',
};

export function FormattedText({ text }: { text: string }) {
    if (!text) return null;

    // Split the text by anything inside curly braces (eg "{P}")
    const parts = text.split(/(\{[A-Z]\})/g);

    return (
        <>
            {parts.map((part, index) => {
                // Check if the current chunk is one of our bracketed symbols
                const match = part.match(/^\{([A-Z])\}$/);
                
                if (match) {
                    const shorthand = match[1];
                    const fullType = SYMBOL_MAP[shorthand];
                    
                    // If we have a matching type, render the icon
                    if (fullType) {
                        return (
                            <span key={index} className="mx-0.5 inline-flex items-center">
                                <EnergyIcon type={fullType} />
                            </span>
                        );
                    }
                }
                
                // Otherwise, just return the plain text fragment
                return <React.Fragment key={index}>{part}</React.Fragment>;
            })}
        </>
    );
}