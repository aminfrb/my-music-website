export const notificationTypeDefs = /* GraphQL */ `
  type Notification {
    id: ID!
    type: NotificationType!
    title: String!
    message: String!
    relatedKind: String
    relatedId: ID
    isRead: Boolean!
    createdAt: DateTime!
  }

  type NotificationEdge { cursor: String!, node: Notification! }
  type NotificationConnection {
    edges: [NotificationEdge!]!
    nodes: [Notification!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  extend type Query {
    notifications(first: Int, after: String): NotificationConnection!
    unreadNotificationCount: Int!
  }

  extend type Mutation {
    markNotificationsRead(ids: [ID!]!): Int!
    markAllNotificationsRead: Int!
  }
`;
