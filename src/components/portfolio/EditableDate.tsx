'use client';

import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Calendar } from '@/src/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';
import { useCollectionStore } from '@/src/lib/store/collectionStore';
import { toast } from 'sonner';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface EditableDateProps {
    id: string;
    date: Date;
}

export function EditableDate({ id, date }: EditableDateProps) {
    const [currentDate, setCurrentDate] = useState<Date>(new Date(date));
    const [isOpen, setIsOpen] = useState(false);
    const updateEntry = useCollectionStore((state) => state.updateEntry);

    const handleSelect = async (newDate: Date | undefined) => {
        if (!newDate) return;
        
        const previousDate = currentDate;
        setCurrentDate(newDate); // Optimistic local state update
        setIsOpen(false);
        
        try {
            await updateEntry(id, { createdAt: newDate });
            toast.success('Acquisition date updated');
        } catch (error) {
            toast.error('Failed to update date');
            setCurrentDate(previousDate); // Revert on error
        }
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant='ghost'
                    className={cn(
                        'h-8 justify-start px-2 text-left font-normal',
                        !currentDate && 'text-muted-foreground'
                    )}
                >
                    <CalendarIcon className='mr-2 h-3 w-3 opacity-50' />
                    {currentDate ? format(currentDate, 'MMM d, yyyy') : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0' align='start'>
                <Calendar
                    mode='single'
                    selected={currentDate}
                    onSelect={handleSelect}
                    disabled={(date) => date > new Date() || date < new Date('1990-01-01')}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    );
}
