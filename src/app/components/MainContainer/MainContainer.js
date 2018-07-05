import React from 'react';
import { actions } from '../../store';
import Main from './Main/Main';
import {
  getUsers,
  getOrganizations,
  getTickets,
  getDetails,
  deleteItem,
} from './actions';

export default class MainContainer extends React.Component {
  constructor(props) {
    super(props);

    this.getItemDetails = this.getItemDetails.bind(this);
    this.sendDeleteRequest = this.sendDeleteRequest.bind(this);
  }

  componentDidMount() {
    getUsers()
      .then(res => actions.setUsers(res.data))
      .catch(err => console.log(err));

    getOrganizations()
      .then(res => actions.setOrganizations(res.data))
      .catch(err => console.log(err));

    getTickets()
      .then(res => actions.setTickets(res.data))
      .catch(err => console.log(err));
  }

  /**
   * Fires action that sends request to API for getting item details.
   * @param {string} type
   * @param {number|string} id
   */
  getItemDetails(type, id) {
    getDetails(type, id).then(res => actions.addTab({ type, data: res.data }));
  }

  /**
   * Fires action that sends request to API for item deleting.
   * @param {string} type
   * @param {number|string} id
   */
  sendDeleteRequest(type, id) {
    deleteItem(type, id)
      .then(() => {
        actions.removeTab(id);

        switch (type) {
          case 'people':
            actions.removeUser(id);
            getUsers().then(res => actions.setUsers(res.data));
            break;

          case 'organizations':
            actions.removeOrganization(id);
            getOrganizations().then(res => actions.setOrganizations(res.data));
            break;

          case 'tickets':
            actions.removeTicket(id);
            getTickets().then(res => actions.setTickets(res.data));
            break;

          default:
            break;
        }
      }).catch(err => console.log(err));
  }

  render() {
    return (
      <Main
        onClickListItem={this.getItemDetails}
        onDeleteItem={this.sendDeleteRequest}
      />
    );
  }
}
