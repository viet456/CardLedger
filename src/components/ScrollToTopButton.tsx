'use client';
import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from './ui/button';

export function ScrollToTopButton() {
    const [isVisible, setIsVisible] = useState(false);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'instant'
        });
    };

    useEffect(() => {
        const toggleVisibility = () => {
            if (window.scrollY > 300) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };
        window.addEventListener('scroll', toggleVisibility);
        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

    return (
        <div className='fixed bottom-4 right-4'>
            {isVisible && (
                <Button
                    variant='outline'
                    onClick={scrollToTop}
                    size='icon'
                    aria-label='Scroll to top'
                    className='rounded-full opacity-75 transition-opacity hover:opacity-100'
                >
                    <ArrowUp className='h-4 w-4' />
                </Button>
            )}
        </div>
    );
}
