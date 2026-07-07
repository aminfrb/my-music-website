import { DateTimeResolver } from "graphql-scalars";
import { GraphQLUpload } from "graphql-upload-minimal";

export const scalarResolvers = {
  DateTime: DateTimeResolver,
  Upload: GraphQLUpload,
};
