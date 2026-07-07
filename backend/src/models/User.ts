import { Schema, model, models, type Model, type Types } from "mongoose";
import { ROLES, LOCALES, USER_STATUSES, type Role, type Locale, type UserStatus } from "../constants";

export interface IUser {
  _id: Types.ObjectId;
  displayName: string;
  email: string;
  passwordHash: string;
  mobileNumber?: string | null;
  profileImageKey?: string | null;
  bio?: string | null;
  locale: Locale;
  status: UserStatus;
  role: Role;
  isVerifiedArtist: boolean;
  isTrusted: boolean;
  /** Whether other users may start a direct-message conversation with this user. */
  allowMessages: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    displayName: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    mobileNumber: { type: String, default: null, sparse: true },
    profileImageKey: { type: String, default: null },
    bio: { type: String, default: null, maxlength: 500 },
    locale: { type: String, enum: LOCALES, default: "en" },
    status: { type: String, enum: USER_STATUSES, default: "active", index: true },
    role: { type: String, enum: ROLES, default: "user" },
    isVerifiedArtist: { type: Boolean, default: false },
    isTrusted: { type: Boolean, default: false },
    allowMessages: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.index({ displayName: "text" });

export const User: Model<IUser> = models.User || model<IUser>("User", userSchema);
