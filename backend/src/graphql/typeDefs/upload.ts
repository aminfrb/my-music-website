export const uploadTypeDefs = /* GraphQL */ `
  type UploadAsset {
    key: String!
    mimeType: String
    size: Int
    duration: Int
    finalized: Boolean!
  }

  type UploadSession {
    id: ID!
    status: String!
    step: Int!
    audio: UploadAsset
    cover: UploadAsset
    metadata: UploadMetadata!
    music: Music
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type UploadMetadata {
    title: String
    artistName: String
    caption: String
    description: String
    genre: Genre
    tags: [String!]!
    visibility: Visibility!
  }

  "A presigned PUT URL the client uploads the file directly to."
  type PresignedUpload {
    session: UploadSession!
    key: String!
    url: String!
  }

  input UploadMetadataInput {
    title: String
    artistName: String
    caption: String
    description: String
    genreId: ID
    tags: [String!]
    visibility: Visibility
    duration: Int
  }

  extend type Query {
    uploadSession(id: ID!): UploadSession
  }

  extend type Mutation {
    "Step 1: start a Divar-style upload session."
    createUploadSession: UploadSession!
    "Step 2a: get a presigned URL to upload the audio file directly to storage."
    requestAudioUpload(sessionId: ID!, contentType: String): PresignedUpload!
    "Step 2b: validate the uploaded audio (real mime-type sniff + dedup)."
    finalizeAudioUpload(sessionId: ID!): UploadSession!
    requestCoverUpload(sessionId: ID!, contentType: String): PresignedUpload!
    finalizeCoverUpload(sessionId: ID!): UploadSession!
    "Step 3: set track metadata."
    setUploadMetadata(sessionId: ID!, input: UploadMetadataInput!): UploadSession!
    "Final step: publish (enters moderation unless auto-publish is on)."
    publishUpload(sessionId: ID!): Music!
  }
`;
