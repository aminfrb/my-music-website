import { Music, User, type IReport } from "../../models";
import { idOf } from "./helpers";

export const reportResolvers = {
  Report: {
    id: idOf,
    music: (p: IReport) => Music.findById(p.music).lean().exec(),
    reporter: (p: IReport) => User.findById(p.reporter).lean().exec(),
  },
};
