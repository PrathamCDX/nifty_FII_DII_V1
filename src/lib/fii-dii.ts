import mongoose from "mongoose";
import { connectToDatabase } from "./mongodb";

export type FiiDiiRow = { date: string; fii: number; dii: number };

export type SyncSummary = {
  added: number;
  skipped: number;
  lastDate: string | null;
};

type FiiDiiDoc = {
  date: string;
  fii: number;
  dii: number;
  net: number;
};

type FiiDiiModel = mongoose.Model<FiiDiiDoc>;

const fiiDiiSchema = new mongoose.Schema<FiiDiiDoc>(
  {
    date: { type: String, required: true, unique: true },
    fii: { type: Number, required: true },
    dii: { type: Number, required: true },
    net: { type: Number, required: true },
  },
  { timestamps: true, collection: "fii_dii" }
);

function getFiiDiiModel(): FiiDiiModel {
  const existing = mongoose.models.FiiDii as FiiDiiModel | undefined;
  return existing ?? mongoose.model<FiiDiiDoc>("FiiDii", fiiDiiSchema);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function findLastFiiDiiDate(): Promise<string | null> {
  await connectToDatabase();
  const doc = await getFiiDiiModel()
    .findOne()
    .sort({ date: -1 })
    .select({ date: 1 })
    .lean();
  return doc?.date ?? null;
}

export async function readFiiDiiMap(): Promise<Map<string, { fii: number; dii: number }> | null> {
  try {
    await connectToDatabase();
    const docs = await getFiiDiiModel()
      .find()
      .select({ date: 1, fii: 1, dii: 1, _id: 0 })
      .lean();
    const map = new Map<string, { fii: number; dii: number }>();
    for (const doc of docs) {
      map.set(doc.date, { fii: doc.fii, dii: doc.dii });
    }
    return map;
  } catch (err) {
    console.error(`[db] failed to read FII/DII archive: ${errorMessage(err)}`);
    return null;
  }
}

export function pendingFiiDiiRows(rows: FiiDiiRow[], lastDate: string | null): FiiDiiRow[] {
  return rows
    .filter((row) => row.fii != null && row.dii != null)
    .filter((row) => lastDate === null || row.date > lastDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function syncFiiDii(rows: FiiDiiRow[]): Promise<SyncSummary> {
  try {
    await connectToDatabase();
    const lastDate = await findLastFiiDiiDate();
    const pending = pendingFiiDiiRows(rows, lastDate);
    if (pending.length === 0) {
      return { added: 0, skipped: rows.length, lastDate };
    }
    const result = await getFiiDiiModel().bulkWrite(
      pending.map((row) => ({
        updateOne: {
          filter: { date: row.date },
          update: {
            $setOnInsert: {
              date: row.date,
              fii: row.fii,
              dii: row.dii,
              net: row.fii + row.dii,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
    return {
      added: result.upsertedCount,
      skipped: rows.length - pending.length,
      lastDate: pending[pending.length - 1].date,
    };
  } catch (err) {
    console.error(`[db] FII/DII sync failed: ${errorMessage(err)}`);
    return { added: 0, skipped: rows.length, lastDate: null };
  }
}
