export const reportTypeDefs = /* GraphQL */ `
  type Report {
    id: ID!
    reason: ReportReason!
    description: String
    status: ReportStatus!
    music: Music!
    reporter: User!
    createdAt: DateTime!
  }

  type ReportEdge { cursor: String!, node: Report! }
  type ReportConnection {
    edges: [ReportEdge!]!
    nodes: [Report!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input ReportInput {
    musicId: ID!
    reason: ReportReason!
    description: String
  }
`;
