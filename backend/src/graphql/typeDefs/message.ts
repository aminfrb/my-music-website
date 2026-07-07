export const messageTypeDefs = /* GraphQL */ `
  type Message {
    id: ID!
    conversationId: ID!
    sender: User!
    recipient: User!
    body: String!
    isRead: Boolean!
    "True when the signed-in user sent this message."
    mine: Boolean!
    createdAt: DateTime!
  }

  type MessageEdge { cursor: String!, node: Message! }
  type MessageConnection {
    edges: [MessageEdge!]!
    nodes: [Message!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type Conversation {
    id: ID!
    "The other participant (not the signed-in user)."
    otherUser: User!
    lastMessage: String!
    lastMessageAt: DateTime!
    unreadCount: Int!
  }

  extend type Query {
    "The signed-in user's conversations, most recently active first."
    conversations(first: Int): [Conversation!]!
    "Message thread with another user, newest first."
    messagesWith(userId: ID!, first: Int, after: String): MessageConnection!
    "Whether the signed-in user may message this user (privacy + not self)."
    canMessage(userId: ID!): Boolean!
    "Total unread direct messages for the signed-in user."
    unreadMessageCount: Int!
  }

  extend type Mutation {
    sendMessage(toUserId: ID!, body: String!): Message!
    markConversationRead(userId: ID!): Boolean!
    "Toggle whether other users can send you direct messages."
    setAllowMessages(allow: Boolean!): User!
  }
`;
