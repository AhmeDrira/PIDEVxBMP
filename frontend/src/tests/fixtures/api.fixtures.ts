import { artisanUser, expertUser } from './user.fixtures';

const isoNow = '2026-04-22T10:00:00.000Z';

export const statsResponse = {
  activeUsers: 120,
  projects: 56,
  satisfaction: 96,
};

export const conversationsResponse = [
  {
    _id: 'conv-1',
    participants: [
      {
        _id: artisanUser._id,
        firstName: artisanUser.firstName,
        lastName: artisanUser.lastName,
        role: artisanUser.role,
      },
      {
        _id: expertUser._id,
        firstName: expertUser.firstName,
        lastName: expertUser.lastName,
        role: expertUser.role,
      },
    ],
    lastMessage: 'Welcome to the chat',
    updatedAt: isoNow,
    unread: 1,
    blockedByMe: false,
    blockedByOther: false,
  },
];

export const messagesResponse = [
  {
    _id: 'msg-1',
    sender: {
      _id: expertUser._id,
      firstName: expertUser.firstName,
      lastName: expertUser.lastName,
    },
    content: 'Welcome to the chat',
    createdAt: isoNow,
    attachments: [],
    reactions: [],
  },
];

export const makePostedMessage = (content: string) => ({
  _id: 'msg-posted-1',
  sender: {
    _id: artisanUser._id,
    firstName: artisanUser.firstName,
    lastName: artisanUser.lastName,
  },
  content,
  createdAt: isoNow,
  attachments: [],
  reactions: [],
});
