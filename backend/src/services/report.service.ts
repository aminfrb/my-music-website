import { z } from "zod";
import { Types } from "mongoose";
import { Report, Music, type IReport, type IUser } from "../models";
import { errors } from "../utils/errors";
import { parse } from "./auth.service";
import { REPORT_REASONS } from "../constants";

const reportSchema = z.object({
  musicId: z.string(),
  reason: z.enum(REPORT_REASONS),
  description: z.string().max(1000).nullish(),
});

export const reportService = {
  async report(user: IUser, input: unknown): Promise<IReport> {
    const data = parse(reportSchema, input);
    if (!Types.ObjectId.isValid(data.musicId)) throw errors.notFound("errors.musicNotFound");
    const music = await Music.findById(data.musicId).select("_id").lean().exec();
    if (!music) throw errors.notFound("errors.musicNotFound");

    const existing = await Report.findOne({
      reporter: user._id,
      music: data.musicId,
      status: { $in: ["pending", "reviewed"] },
    });
    if (existing) throw errors.conflict("errors.reportExists");

    return Report.create({
      reporter: user._id,
      music: new Types.ObjectId(data.musicId),
      reason: data.reason,
      description: data.description ?? null,
    }).then((r) => r.toObject());
  },
};
