/**
 * One-off data repair (2026-09): re-point stale Card ids at their current
 * TCGdex ids. Card ids must be current TCGdex ids — TCGdex is the naming
 * authority and canonical, OG and sitemap URLs all embed Card.id. Rows
 * populated from older TCGdex generations (and pre-migration ids) survive
 * renames because populate.ts upserts by id and never deletes strays.
 *
 * Families covered (found by scripts/auditTcgdexIds.ts):
 *   - cel25-XXA        pre-migration shells -> cel25cc-CC0xx keepers (verified by hand)
 *   - bwp-BW004/005    3-digit promo numbers -> 2-digit (BW04/BW05)
 *   - ecard2/3-H1..H9  unpadded holo numbers -> H01..H09
 *   - ecard2-103/50/.. pre-migration un-suffixed rows -> the "a" twin (103a/50a/..)
 *   - sm*-NNNa/b       old per-variant rows folded by TCGdex into the base card
 *   - sve-1..16        renumbered to sve-001..016 ("Basic X Energy" -> "X Energy")
 *   - mcd22-*, mcd15-8 set consolidation (mcd22's tcgdexId IS 2022swsh)
 *   - ex10-?           the "?" Unown now lives at exu-%3F
 *
 * Keeper rows that exist -> children merge onto them (keeper's own data wins on
 * unique collisions). Keeper rows that do NOT exist (gaps: 2022swsh-*, exu-%3F)
 * -> the row is renamed in place and FKs cascade the child cardIds.
 *
 * Usage:
 *   pnpm run db:merge-legacy-ids              # dry-run (rolls back)
 *   pnpm run db:merge-legacy-ids -- --apply   # commit
 */
import 'dotenv/config';
import { Pool } from 'pg';

// Tables with a cardId FK to Card. Deleting the shells cascades the stale
// per-card copies (subtypes/types/attacks/abilities/weaknesses/resistances);
// this list is also the post-repair orphan check.
const CHILD_TABLES = [
    'PriceHistory',
    'MarketStats',
    'CollectionEntry',
    'SubtypesOnCards',
    'TypesOnCards',
    'Ability',
    'Attack',
    'Weakness',
    'Resistance'
];

const FIX: Array<{ from: string; to: string }> = [
    // --- bwp: promo numbers zero-padded differently in old TCGdex ---
    { from: 'bwp-BW004', to: 'bwp-BW04' },
    { from: 'bwp-BW005', to: 'bwp-BW05' },
    // --- cel25: pre-migration Classic Collection shells -> cel25cc keepers
    // (verified by hand against the TCGdex cel25cc listing: CC001..CC025) ---
    { from: 'cel25-2A', to: 'cel25cc-CC001' }, // Blastoise
    { from: 'cel25-4A', to: 'cel25cc-CC002' }, // Charizard
    { from: 'cel25-15A', to: 'cel25cc-CC003' }, // Venusaur
    { from: 'cel25-15A1', to: 'cel25cc-CC003' }, // Venusaur (second legacy shell)
    { from: 'cel25-73A', to: 'cel25cc-CC004' }, // Imposter Professor Oak
    { from: 'cel25-8A', to: 'cel25cc-CC005' }, // Dark Gyarados
    { from: 'cel25-15A2', to: 'cel25cc-CC006' }, // Here Comes Team Rocket!
    { from: 'cel25-15A3', to: 'cel25cc-CC007' }, // Rocket's Zapdos
    { from: 'cel25-24A', to: 'cel25cc-CC008' }, // _____'s Pikachu
    { from: 'cel25-20A', to: 'cel25cc-CC009' }, // Cleffa
    { from: 'cel25-66A', to: 'cel25cc-CC010' }, // Shining Magikarp
    { from: 'cel25-9A', to: 'cel25cc-CC011' }, // Team Magma's Groudon
    { from: 'cel25-86A', to: 'cel25cc-CC012' }, // Rocket's Admin.
    { from: 'cel25-88A', to: 'cel25cc-CC013' }, // Mew ex
    { from: 'cel25-93A', to: 'cel25cc-CC014' }, // Gardevoir ex
    { from: 'cel25-17A', to: 'cel25cc-CC015' }, // Umbreon Star = "Umbreon ☆"
    { from: 'cel25-15A4', to: 'cel25cc-CC016' }, // Claydol
    { from: 'cel25-109A', to: 'cel25cc-CC017' }, // Luxray GL LV.X
    { from: 'cel25-145A', to: 'cel25cc-CC018' }, // Garchomp C LV.X
    { from: 'cel25-107A', to: 'cel25cc-CC019' }, // Donphan
    { from: 'cel25-113A', to: 'cel25cc-CC020' }, // Reshiram
    { from: 'cel25-114A', to: 'cel25cc-CC021' }, // Zekrom
    { from: 'cel25-54A', to: 'cel25cc-CC022' }, // Mewtwo EX
    { from: 'cel25-97A', to: 'cel25cc-CC023' }, // Xerneas EX
    { from: 'cel25-76A', to: 'cel25cc-CC024' }, // M Rayquaza EX
    { from: 'cel25-60A', to: 'cel25cc-CC025' }, // Tapu Lele GX
    // --- ecard2/3: unpadded holo numbers -> zero-padded (H1 -> H01) ---
    { from: 'ecard2-H1', to: 'ecard2-H01' },
    { from: 'ecard2-H2', to: 'ecard2-H02' },
    { from: 'ecard2-H3', to: 'ecard2-H03' },
    { from: 'ecard2-H4', to: 'ecard2-H04' },
    { from: 'ecard2-H5', to: 'ecard2-H05' },
    { from: 'ecard2-H6', to: 'ecard2-H06' },
    { from: 'ecard2-H7', to: 'ecard2-H07' },
    { from: 'ecard2-H8', to: 'ecard2-H08' },
    { from: 'ecard2-H9', to: 'ecard2-H09' },
    { from: 'ecard3-H1', to: 'ecard3-H01' },
    { from: 'ecard3-H2', to: 'ecard3-H02' },
    { from: 'ecard3-H3', to: 'ecard3-H03' },
    { from: 'ecard3-H4', to: 'ecard3-H04' },
    { from: 'ecard3-H5', to: 'ecard3-H05' },
    { from: 'ecard3-H6', to: 'ecard3-H06' },
    { from: 'ecard3-H7', to: 'ecard3-H07' },
    { from: 'ecard3-H8', to: 'ecard3-H08' },
    { from: 'ecard3-H9', to: 'ecard3-H09' },
    // --- ecard2: pre-migration un-suffixed rows fold into the "a" twin
    // (TCGdex keeps both a/b e-Reader variants; the old row covers one of them) ---
    { from: 'ecard2-103', to: 'ecard2-103a' },
    { from: 'ecard2-50', to: 'ecard2-50a' },
    { from: 'ecard2-74', to: 'ecard2-74a' },
    { from: 'ecard2-95', to: 'ecard2-95a' },
    // --- ex10: the "?" Unown moved to the Unown Collection set (URL-escaped id) ---
    { from: 'ex10-?', to: 'exu-%3F' },
    // --- mcd15: set consolidation ---
    { from: 'mcd15-8', to: '2015xy-8' },
    // --- mcd22: TCGdex merged the set into 2022swsh (renames) ---
    { from: 'mcd22-1', to: '2022swsh-1' },
    { from: 'mcd22-2', to: '2022swsh-2' },
    { from: 'mcd22-3', to: '2022swsh-3' },
    { from: 'mcd22-4', to: '2022swsh-4' },
    { from: 'mcd22-5', to: '2022swsh-5' },
    { from: 'mcd22-6', to: '2022swsh-6' },
    { from: 'mcd22-7', to: '2022swsh-7' },
    { from: 'mcd22-8', to: '2022swsh-8' },
    { from: 'mcd22-9', to: '2022swsh-9' },
    { from: 'mcd22-10', to: '2022swsh-10' },
    { from: 'mcd22-11', to: '2022swsh-11' },
    { from: 'mcd22-12', to: '2022swsh-12' },
    { from: 'mcd22-13', to: '2022swsh-13' },
    { from: 'mcd22-14', to: '2022swsh-14' },
    { from: 'mcd22-15', to: '2022swsh-15' },
    // --- sm/smp: TCGdex folded old per-variant rows (…a/…b) into the base card
    // (its `variants` flags now cover the finishes) ---
    { from: 'sm1-101a', to: 'sm1-101' },
    { from: 'sm2-19a', to: 'sm2-19' },
    { from: 'sm2-21a', to: 'sm2-21' },
    { from: 'sm2-51a', to: 'sm2-51' },
    { from: 'sm2-60a', to: 'sm2-60' },
    { from: 'sm2-92a', to: 'sm2-92' },
    { from: 'sm2-121a', to: 'sm2-121' },
    { from: 'sm2-124a', to: 'sm2-124' },
    { from: 'sm2-125a', to: 'sm2-125' },
    { from: 'sm2-128a', to: 'sm2-128' },
    { from: 'sm2-130a', to: 'sm2-130' },
    { from: 'sm2-157a', to: 'sm2-157' }, // Secret Rare #157, NOT sm2-85
    { from: 'sm3-18a', to: 'sm3-18' },
    { from: 'sm3-39a', to: 'sm3-39' },
    { from: 'sm3-88a', to: 'sm3-88' },
    { from: 'sm3-92a', to: 'sm3-92' },
    { from: 'sm3-105a', to: 'sm3-105' },
    { from: 'sm3-112a', to: 'sm3-112' },
    { from: 'sm3-115a', to: 'sm3-115' },
    { from: 'sm3-116a', to: 'sm3-116' },
    { from: 'sm3.5-10a', to: 'sm3.5-10' },
    { from: 'sm3.5-68a', to: 'sm3.5-68' },
    { from: 'sm3.5-77a', to: 'sm3.5-77' },
    { from: 'sm4-84a', to: 'sm4-84' },
    { from: 'sm5-119a', to: 'sm5-119' },
    { from: 'sm5-122a', to: 'sm5-122' },
    { from: 'sm5-125a', to: 'sm5-125' },
    { from: 'sm5-135a', to: 'sm5-135' },
    { from: 'sm5-153a', to: 'sm5-153' },
    { from: 'sm6-2a', to: 'sm6-2' },
    { from: 'sm6-102a', to: 'sm6-102' },
    { from: 'sm6-112a', to: 'sm6-112' },
    { from: 'sm6-113a', to: 'sm6-113' },
    { from: 'sm7-10a', to: 'sm7-10' },
    { from: 'sm7-123a', to: 'sm7-123' },
    { from: 'sm7-148a', to: 'sm7-148' },
    { from: 'sm7-177a', to: 'sm7-177' },
    { from: 'sm7.5-40a', to: 'sm7.5-40' },
    { from: 'sm7.5-60a', to: 'sm7.5-60' },
    { from: 'sm8-172a', to: 'sm8-172' },
    { from: 'sm8-187a', to: 'sm8-187' },
    { from: 'sm8-188a', to: 'sm8-188' },
    { from: 'sm8-189a', to: 'sm8-189' },
    { from: 'sm9-152a', to: 'sm9-152' },
    { from: 'sm9-152b', to: 'sm9-152' },
    { from: 'sm10-182a', to: 'sm10-182' },
    { from: 'sm10-182b', to: 'sm10-182' },
    { from: 'sm10-189a', to: 'sm10-189' },
    { from: 'sm10-195a', to: 'sm10-195' },
    { from: 'sm11-191a', to: 'sm11-191' },
    { from: 'sm11-206a', to: 'sm11-206' },
    { from: 'sm12-143a', to: 'sm12-143' },
    { from: 'smp-SM30a', to: 'smp-SM30' },
    { from: 'smp-SM103a', to: 'smp-SM103' },
    { from: 'smp-SM104a', to: 'smp-SM104' },
    // --- sve: renumbered to 3 digits and renamed ("Basic X Energy" -> "X Energy") ---
    { from: 'sve-1', to: 'sve-001' },
    { from: 'sve-2', to: 'sve-002' },
    { from: 'sve-3', to: 'sve-003' },
    { from: 'sve-4', to: 'sve-004' },
    { from: 'sve-5', to: 'sve-005' },
    { from: 'sve-6', to: 'sve-006' },
    { from: 'sve-7', to: 'sve-007' },
    { from: 'sve-8', to: 'sve-008' },
    { from: 'sve-9', to: 'sve-009' },
    { from: 'sve-10', to: 'sve-010' },
    { from: 'sve-11', to: 'sve-011' },
    { from: 'sve-12', to: 'sve-012' },
    { from: 'sve-13', to: 'sve-013' },
    { from: 'sve-14', to: 'sve-014' },
    { from: 'sve-15', to: 'sve-015' },
    { from: 'sve-16', to: 'sve-016' }
];

async function main() {
    const apply = process.argv.includes('--apply');
    console.log(
        `${apply ? '🔧 APPLY' : '🧪 DRY-RUN'}: repairing ${FIX.length} stale card ids to current TCGdex ids...\n`
    );

    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // --- Preconditions: every source row must exist ---
        const srcRes = await client.query('SELECT id FROM "Card" WHERE id = ANY($1)', [
            FIX.map((m) => m.from)
        ]);
        const haveFrom = new Set<string>(srcRes.rows.map((r: { id: string }) => r.id));
        for (const m of FIX)
            if (!haveFrom.has(m.from)) console.warn(`  ⚠️ ${m.from} already gone — skipping`);
        const live = FIX.filter((m) => haveFrom.has(m.from));
        if (live.length === 0) {
            await client.query('ROLLBACK');
            console.log('\nNothing to do — all stale rows already repaired.');
            return;
        }

        // --- Split by keeper existence ---
        const tgtRes = await client.query('SELECT id FROM "Card" WHERE id = ANY($1)', [
            [...new Set(live.map((m) => m.to))]
        ]);
        const haveTo = new Set<string>(tgtRes.rows.map((r: { id: string }) => r.id));
        const mergePairs = live.filter((m) => haveTo.has(m.to));
        const renamePairs = live.filter((m) => !haveTo.has(m.to));
        if (new Set(renamePairs.map((m) => m.to)).size !== renamePairs.length)
            throw new Error('duplicate rename targets — aborting');
        console.log(
            `  ${mergePairs.length} merges (keeper rows exist), ${renamePairs.length} renames (ids re-point in place)`
        );

        // --- Merges (unique per cardId / cardId+timestamp): repoint, dropping rows
        // that would collide with the keeper's own data or with a lower-named source
        // mapping to the same keeper (cel25-15A vs cel25-15A1 -> CC003). ---
        const mFrom = mergePairs.map((m) => m.from);
        const mTo = mergePairs.map((m) => m.to);

        const phDel = await client.query(
            `DELETE FROM "PriceHistory" ph
             USING unnest($1::text[], $2::text[]) AS m(src, tgt)
             WHERE ph."cardId" = m.src
               AND (
                 EXISTS (SELECT 1 FROM "PriceHistory" k WHERE k."cardId" = m.tgt AND k.timestamp = ph.timestamp)
                 OR EXISTS (
                   SELECT 1 FROM "PriceHistory" k2
                   JOIN unnest($1::text[], $2::text[]) AS m2(src2, tgt2) ON k2."cardId" = m2.src2
                   WHERE m2.tgt2 = m.tgt AND m2.src2 < m.src AND k2.timestamp = ph.timestamp
                 )
               )`,
            [mFrom, mTo]
        );
        const phUpd = await client.query(
            `UPDATE "PriceHistory" ph SET "cardId" = m.tgt
             FROM unnest($1::text[], $2::text[]) AS m(src, tgt)
             WHERE ph."cardId" = m.src`,
            [mFrom, mTo]
        );
        console.log(
            `  PriceHistory: ${phUpd.rowCount} repointed, ${phDel.rowCount} dropped (timestamp collisions)`
        );

        const msDel = await client.query(
            `DELETE FROM "MarketStats" ms
             USING unnest($1::text[], $2::text[]) AS m(src, tgt)
             WHERE ms."cardId" = m.src
               AND (
                 EXISTS (SELECT 1 FROM "MarketStats" k WHERE k."cardId" = m.tgt)
                 OR EXISTS (
                   SELECT 1 FROM "MarketStats" k2
                   JOIN unnest($1::text[], $2::text[]) AS m2(src2, tgt2) ON k2."cardId" = m2.src2
                   WHERE m2.tgt2 = m.tgt AND m2.src2 < m.src
                 )
               )`,
            [mFrom, mTo]
        );
        const msUpd = await client.query(
            `UPDATE "MarketStats" ms SET "cardId" = m.tgt
             FROM unnest($1::text[], $2::text[]) AS m(src, tgt)
             WHERE ms."cardId" = m.src`,
            [mFrom, mTo]
        );
        console.log(
            `  MarketStats: ${msUpd.rowCount} repointed, ${msDel.rowCount} dropped (keeper already had one)`
        );

        const ceUpd = await client.query(
            `UPDATE "CollectionEntry" ce SET "cardId" = m.tgt
             FROM unnest($1::text[], $2::text[]) AS m(src, tgt)
             WHERE ce."cardId" = m.src`,
            [mFrom, mTo]
        );
        console.log(`  CollectionEntry: ${ceUpd.rowCount} repointed`);

        const del = await client.query('DELETE FROM "Card" WHERE id = ANY($1)', [mFrom]);
        console.log(`  Card: ${del.rowCount} stale rows deleted (merged)`);

        // --- Renames: id re-points in place; FKs cascade the child cardIds ---
        if (renamePairs.length) {
            const rFrom = renamePairs.map((m) => m.from);
            const rTo = renamePairs.map((m) => m.to);
            const upd = await client.query(
                `UPDATE "Card" c SET id = m.tgt
                 FROM unnest($1::text[], $2::text[]) AS m(src, tgt)
                 WHERE c.id = m.src`,
                [rFrom, rTo]
            );
            console.log(`  Card: ${upd.rowCount} stale rows renamed in place`);
        }

        // --- Defensive orphan check: catches any child FK that is not CASCADE ---
        const liveFrom = live.map((m) => m.from);
        for (const t of CHILD_TABLES) {
            const r = await client.query(
                `SELECT count(*)::int AS n FROM "${t}" WHERE "cardId" = ANY($1)`,
                [liveFrom]
            );
            if (r.rows[0].n > 0)
                throw new Error(
                    `${t}: ${r.rows[0].n} orphan row(s) left for repaired ids — aborting`
                );
        }

        if (apply) {
            await client.query('COMMIT');
            console.log('\n✅ Committed.');
        } else {
            await client.query('ROLLBACK');
            console.log('\n🧪 Dry-run rolled back. Re-run with --apply to commit.');
        }
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
