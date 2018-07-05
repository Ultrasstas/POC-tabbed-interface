/* eslint no-unused-vars: 0 */
import { initStore } from 'react-waterfall';
import _ from 'lodash';

const store = {
  initialState: {
    users: [],
    organizations: [],
    tickets: [],
    activeTabs: [],
  },
  actions: {
    setUsers: ({ users }, newUsers) => ({ users: _.unionBy(users, newUsers, 'id') }),
    removeUser: ({ users }, id) => ({ users: users.filter(user => user.id !== id) }),
    setTickets: ({ tickets }, newTickets) => ({ tickets: _.unionBy(tickets, newTickets, 'id') }),
    removeTicket: ({ tickets }, id) => ({ tickets: tickets.filter(ticket => ticket.id !== id) }),
    setOrganizations: ({ organizations }, newOrganizations) =>
      ({ organizations: _.unionBy(organizations, newOrganizations, 'id') }),
    removeOrganization: ({ organizations }, id) =>
      ({ organizations: organizations.filter(organization => organization.id !== id) }),
    addTab: ({ activeTabs }, tab) => {
      const sameTabOpened =
        activeTabs.findIndex(item => item.data.id === tab.data.id) + 1;

      if (sameTabOpened) {
        return ({ activeTabs });
      }

      return ({ activeTabs: [...activeTabs, tab] });
    },
    removeTab: ({ activeTabs }, tabId) =>
      ({ activeTabs: activeTabs.filter(tab => tab.data.id !== tabId) }),
  },
};

export const {
  Provider,
  actions,
  connect,
} = initStore(store);
