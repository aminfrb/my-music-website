import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IRefreshToken {
  _id: Types.ObjectId;
  tokenHash: string;
  user: Types.ObjectId;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
}

const schema = new Schema<IRefreshToken>(
  {
    tokenHash: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const RefreshToken: Model<IRefreshToken> =
  models.RefreshToken || model<IRefreshToken>("RefreshToken", schema);
