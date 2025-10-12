export function Footer() {
    return (
        <div className='bg-card p-4 text-xs text-card-foreground'>
            <p>
                The literal and graphical information presented on this website about the Pokémon
                Trading Card Game, including card text and images, are copyright The Pokémon Company
                (Pokémon), Nintendo, Game Freak, Creatures, and/or Wizards of the Coast. This
                website is not produced by, endorsed by, supported by, or affiliated with The
                Pokémon Company (Pokémon), Nintendo, Game Freak, Creatures, or Wizards of the Coast.
            </p>
            <p>
                Created by{' '}
                <a
                    href='https://vietle.me'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='font-semibold text-foreground hover:underline'
                >
                    Viet Le
                </a>
                . All other content © 2025 CardLedger.
            </p>
        </div>
    );
}
