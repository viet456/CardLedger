'use client';
import { useTheme } from 'next-themes';
import { Button } from '@/src/components/ui/button';
import { Sun, Moon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip';

export function ThemeToggle() {
    const { setTheme, theme } = useTheme();
    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant='ghost' size='icon' onClick={toggleTheme}>
                    <Sun className='h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0' />
                    <Moon className='absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100' />
                    <span className='sr-only'>Toggle theme</span>
                </Button>
            </TooltipTrigger>
            <TooltipContent className='px-2 py-1'>
                <p className='text-xs'>Toggle theme</p>
            </TooltipContent>
        </Tooltip>
    );
}
