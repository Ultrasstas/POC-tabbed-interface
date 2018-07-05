/* eslint quote-props: 0 */
import config from './../../../configs/config';
import { createHeaders, createRequest } from './../../utils/request';

/**
 * Makes request to API to get list of users.
 * @returns {Promise<any>}
 */
async function getUsers() {
  const headers = createHeaders({ 'Authorization': `key ${config.api.key}` });
  const request = createRequest('/people', { headers });
  const response = await fetch(request);

  return response.json();
}

/**
 * Makes request to API to get list of organizations.
 * @returns {Promise<any>}
 */
async function getOrganizations() {
  const headers = createHeaders({ 'Authorization': `key ${config.api.key}` });
  const request = createRequest('/organizations', { headers });
  const response = await fetch(request);

  return response.json();
}

/**
 * Makes request to API to get list of tickets.
 * @returns {Promise<any>}
 */
async function getTickets() {
  const headers = createHeaders({ 'Authorization': `key ${config.api.key}` });
  const request = createRequest('/tickets', { headers });
  const response = await fetch(request);

  return response.json();
}

/**
 * Makes request to API that returns item details by item-type and it`s ID.
 * @param {string} type
 * @param {number|string} id
 * @returns {Promise<any>}
 */
async function getDetails(type, id) {
  const headers = createHeaders({ 'Authorization': `key ${config.api.key}` });
  const request = createRequest(`/${type}/${id}`, { headers });
  const response = await fetch(request);

  return response.json();
}

/**
 * Makes request to API for deleting item by item-type and it`s ID.
 * @param {string} type
 * @param {number|string} id
 * @returns {Promise<any>}
 */
async function deleteItem(type, id) {
  const headers = createHeaders({ 'Authorization': `key ${config.api.key}` });
  const request = createRequest(`/${type}/${id}`, { method: 'DELETE', headers });
  const response = await fetch(request);

  return response.json();
}

export {
  getUsers,
  getOrganizations,
  getTickets,
  getDetails,
  deleteItem,
};
