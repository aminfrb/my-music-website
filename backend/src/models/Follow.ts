import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IFollow {
  _id: Types.ObjectId;
  follower: Types.ObjectId;
  following: Types.ObjectId;
  createdAt: Date;
}

const schema = new Schema<IFollow>(
  {
    follower: { type: Schema.Types.ObjectId, ref: "User", required: true },
    following: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ follower: 1, following: 1 }, { unique: true });

export const Follow: Model<IFollow> = models.Follow || model<IFollow>("Follow", schema);
