import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ITag {
  _id: Types.ObjectId;
  name: string; // normalized, lowercased
  isBanned: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ITag>(
  {
    name: { type: String, required: true, unique: true, lowercase: true, trim: true },
    isBanned: { type: Boolean, default: false, index: true },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Tag: Model<ITag> = models.Tag || model<ITag>("Tag", schema);
