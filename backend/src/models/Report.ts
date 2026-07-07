import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  REPORT_REASONS,
  REPORT_STATUSES,
  type ReportReason,
  type ReportStatus,
} from "../constants";

export interface IReport {
  _id: Types.ObjectId;
  reporter: Types.ObjectId;
  music: Types.ObjectId;
  reason: ReportReason;
  description?: string | null;
  status: ReportStatus;
  reviewedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IReport>(
  {
    reporter: { type: Schema.Types.ObjectId, ref: "User", required: true },
    music: { type: Schema.Types.ObjectId, ref: "Music", required: true, index: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    description: { type: String, default: null, maxlength: 1000 },
    status: { type: String, enum: REPORT_STATUSES, default: "pending", index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export const Report: Model<IReport> = models.Report || model<IReport>("Report", schema);
