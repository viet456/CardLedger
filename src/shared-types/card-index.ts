export type SetObject = {
    id: string;
    name: string;
    printedTotal: number;
};

export type LookupTables = {
    supertypes: string[];
    rarities: string[];
    sets: SetObject[];
    types: string[];
    subtypes: string[];
    artists: string[];
};

export type NormalizedCard = {
    id: string;
    n: string; // name
    hp: number | null;
    num: string;
    img: string | null; //image key
    rD: string; // release date
    pS: number | null; // pokedex number
    cRC: number | null; // converted retreat cost
    st: number; // supertype id
    a: number | null; // artist id
    r: number | null; // rarity id
    s: number; // set id
    t: number[]; // type ids
    sb: number[]; // subtype ids
    w: number[]; // weakness ids
    rs: number[]; // resistance ids
};

export type DenormalizedCard = {
    id: string;
    n: string;
    hp: number | null;
    num: string;
    img: string | null;
    rD: string;
    pS: number | null;
    cRC: number | null;
    artist: string | null;
    rarity: string | null;
    set: SetObject;
    supertype: string;
    subtypes: string[];
    types: string[];
    weaknesses: string[];
    resistances: string[];
};

export type PointerFile = {
    version: string;
    url: string;
    checkSum: string;
    cardCount: number;
    updatedAt: string;
};

export type FullCardData = LookupTables & { cards: NormalizedCard[]; version: string };
