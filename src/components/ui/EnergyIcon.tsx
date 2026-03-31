const TYPE_MAP: Record<string, string> = {
    Grass: '/types/grass.png',
    Fire: '/types/fire.png',
    Water: '/types/water.png',
    Lightning: '/types/lightning.png',
    Psychic: '/types/psychic.png',
    Fighting: '/types/fighting.png',
    Darkness: '/types/darkness.png',
    Metal: '/types/metal.png',
    Fairy: '/types/fairy.png',
    Dragon: '/types/dragon.png',
    Colorless: '/types/colorless.png',
};

export function EnergyIcon({type, size = 16}: {type: string; size?: number}) {
    const src = TYPE_MAP[type];
    if (!src) return <span className="text-xs text-muted-foreground">{type}</span>;

    return (
        <img
            src={src}
            alt={type}
            width={size}
            height={size}
            className="inline-block align-middle"
            title={type}
        />
    )
}