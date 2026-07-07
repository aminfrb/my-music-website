import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IGenre {
  _id: Types.ObjectId;
  slug: string;
  nameEn: string;
  nameFa: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IGenre>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    nameEn: { type: String, required: true },
    nameFa: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Genre: Model<IGenre> = models.Genre || model<IGenre>("Genre", schema);
