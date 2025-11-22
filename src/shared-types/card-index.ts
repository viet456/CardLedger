export type WeaknessResistanceObject = {
    type: string;
    value: string | null;
};
export type AttackObject = {
    name: string;
    cost: string[];
    damage: string | null;
    text: string | null;
};

export type AbilityObject = {
    name: string;
    text: string;
    type: string;
};

type FilterOptionObject = { id: number | string; name: string };
export type FilterOptions = {
    rarities: FilterOptionObject[] | string[];
    types: FilterOptionObject[] | string[];
    subtypes: FilterOptionObject[] | string[];
    artists: FilterOptionObject[] | string[];
    weaknesses: FilterOptionObject[] | string[];
    resistances: FilterOptionObject[] | string[];
};

export type SetPageProps = {
    setInfo: SetObject;
};

export type SetObject = {
    id: string;
    name: string;
    printedTotal: number;
    logoImageKey?: string | null;
    symbolImageKey?: string | null;
    series: string;
    releaseDate: string;
    ptcgoCode: string | null;
};

export type LookupTables = {
    supertypes: string[];
    rarities: string[];
    sets: SetObject[];
    types: string[];
    subtypes: string[];
    artists: string[];
    abilities: AbilityObject[];
    attacks: AttackObject[];
    rules: string[];
    weaknesses: WeaknessResistanceObject[];
    resistances: WeaknessResistanceObject[];
};

export type NormalizedCard = {
    id: string;
    n: string; // name
    hp: number | null;
    num: string;
    img: string | null; //image key
    pS: number | null; // pokedex number
    cRC: number | null; // converted retreat cost
    st: number; // supertype id
    a: number | null; // artist id
    r: number | null; // rarity id
    s: number; // set id
    t: number[]; // type ids
    sb: number[]; // subtype ids
    w: { t: number; v: string | null }[]; // weakness { typeId, value }
    rs: { t: number; v: string | null }[]; // resistance { typeId, value }
    ab: number[];
    ru: number[]; // rules
    ak: number[]; // attacks
    eF: string | null; // evolvesFrom
    eT: string[]; // evolvesTo
    leg: { s?: string; e?: string; u?: string }; // legalities
    pdx: number[] | null; // pokedexNumbers
    aT: { n: string; t: string } | null; // ancientTrait
};

export type DenormalizedCard = {
    id: string;
    n: string;
    hp: number | null;
    num: string;
    img: string | null;
    pS: number | null;
    cRC: number | null;
    artist: string | null;
    rarity: string | null;
    set: SetObject;
    supertype: string;
    subtypes: string[];
    types: string[];
    rules: string[];
    attacks: AttackObject[];
    weaknesses: WeaknessResistanceObject[];
    resistances: WeaknessResistanceObject[];
    evolvesFrom: string | null;
    evolvesTo: string[];
    abilities: AbilityObject[];
    legalities: {
        standard?: string | null;
        expanded?: string | null;
        unlimited?: string | null;
    };
    pokedexNumbers: number[] | null;
    ancientTrait: {
        name: string;
        text: string;
    } | null;
    price: number | null;
};

export type PointerFile = {
    version: string;
    url: string;
    checkSum: string;
    cardCount: number;
    updatedAt: string;
};

export type FullCardData = LookupTables & { cards: NormalizedCard[]; version: string };
