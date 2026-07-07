import { z } from "zod";
import { Genre, Tag, type IGenre, type ITag } from "../models";
import { errors } from "../utils/errors";
import { parse } from "./auth.service";
import { normalizeTag } from "../utils/text";

const genreSchema = z.object({
  slug: z.string().min(1).max(40),
  nameEn: z.string().min(1),
  nameFa: z.string().min(1),
});

export const catalogService = {
  // ── Genres ──
  genres(): Promise<IGenre[]> {
    return Genre.find({ isActive: true }).sort({ nameEn: 1 }).lean<IGenre[]>().exec();
  },
  genreBySlug(slug: string): Promise<IGenre | null> {
    return Genre.findOne({ slug: slug.toLowerCase() }).lean<IGenre>().exec();
  },
  async createGenre(input: unknown): Promise<IGenre> {
    const data = parse(genreSchema, input);
    const exists = await Genre.exists({ slug: data.slug.toLowerCase() });
    if (exists) throw errors.conflict("errors.validation");
    return Genre.create({ ...data, slug: data.slug.toLowerCase() }).then((g) => g.toObject());
  },
  async setGenreActive(slug: string, isActive: boolean): Promise<IGenre> {
    const g = await Genre.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      { $set: { isActive } },
      { new: true },
    ).lean<IGenre>().exec();
    if (!g) throw errors.notFound("errors.genreNotFound");
    return g;
  },

  // ── Tags ──
  tags(query?: string | null, limit = 30): Promise<ITag[]> {
    const filter: Record<string, unknown> = { isBanned: false };
    if (query) filter.name = new RegExp(normalizeTag(query), "i");
    return Tag.find(filter).sort({ usageCount: -1 }).limit(limit).lean<ITag[]>().exec();
  },
  bannedTags(): Promise<ITag[]> {
    return Tag.find({ isBanned: true }).sort({ name: 1 }).lean<ITag[]>().exec();
  },
  async setTagBanned(name: string, isBanned: boolean): Promise<ITag> {
    const normalized = normalizeTag(name);
    const tag = await Tag.findOneAndUpdate(
      { name: normalized },
      { $set: { isBanned }, $setOnInsert: { usageCount: 0 } },
      { new: true, upsert: true },
    ).lean<ITag>().exec();
    return tag!;
  },
};
