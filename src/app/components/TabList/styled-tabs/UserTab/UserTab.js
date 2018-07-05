/* eslint camelcase: 0 */
import React from 'react';
import { Button, Item, Segment } from 'semantic-ui-react';

export default function UserTab(props) {
  const { user } = props;
  const { id, name, primary_email, gravatar_url } = user;

  return (
    <Segment>
      <Item.Group relaxed>
        <Item>
          <Item.Image size="small" src={gravatar_url} />

          <Item.Content verticalAlign="middle">
            <Item.Header>{name}</Item.Header>
            <Item.Description>
              <p>Id: {id}</p>
              <p>Email: {primary_email}</p>
            </Item.Description>
            <Item.Extra>
              <Button
                negative
                floated="right"
                onClick={() => props.onDelete('people', id)}
              >Delete
              </Button>
            </Item.Extra>
          </Item.Content>
        </Item>
      </Item.Group>
    </Segment>
  );
}
